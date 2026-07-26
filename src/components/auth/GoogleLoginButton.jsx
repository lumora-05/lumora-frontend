import { useEffect, useRef, useState } from 'react';

const GOOGLE_SCRIPT_ID = 'google-identity-services';
let googleScriptPromise;

function clearGoogleButtonFocus() {
  window.requestAnimationFrame(() => {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }
  });
}

function loadGoogleIdentityServices() {
  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google);
  }

  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID);
    const script = existingScript || document.createElement('script');

    const handleLoad = () => {
      if (window.google?.accounts?.id) {
        resolve(window.google);
      } else {
        reject(new Error('Google Identity Services không khả dụng.'));
      }
    };

    const handleError = () => {
      googleScriptPromise = undefined;
      reject(new Error('Không thể tải dịch vụ đăng nhập Google.'));
    };

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });

    if (!existingScript) {
      script.id = GOOGLE_SCRIPT_ID;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

  return googleScriptPromise;
}

export default function GoogleLoginButton({ disabled = false, onSuccess, onError }) {
  const buttonRef = useRef(null);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const [configurationError, setConfigurationError] = useState('');

  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
    let cancelled = false;

    if (!clientId) {
      setConfigurationError('Đăng nhập Google chưa được cấu hình.');
      return undefined;
    }

    setConfigurationError('');

    loadGoogleIdentityServices()
      .then((google) => {
        if (cancelled || !buttonRef.current) return;

        google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            clearGoogleButtonFocus();

            if (!response?.credential) {
              onErrorRef.current?.(new Error('Google không trả về thông tin đăng nhập.'));
              return;
            }

            try {
              await onSuccessRef.current?.(response.credential);
            } catch (error) {
              onErrorRef.current?.(error);
            }
          },
          cancel_on_tap_outside: true,
        });

        buttonRef.current.replaceChildren();
        google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'pill',
          logo_alignment: 'left',
          width: Math.max(240, Math.floor(buttonRef.current.clientWidth || 330)),
          locale: 'vi',
          click_listener: clearGoogleButtonFocus,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setConfigurationError('Không thể tải đăng nhập Google.');
        onErrorRef.current?.(error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (configurationError) {
    return <p className="lumora-google-config-message">{configurationError}</p>;
  }

  return (
    <div
      className={`lumora-google-login${disabled ? ' is-disabled' : ''}`}
      aria-disabled={disabled}
    >
      <div ref={buttonRef} className="lumora-google-login-button" />
    </div>
  );
}
