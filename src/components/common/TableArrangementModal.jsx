import { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Link2, Table2, Unlink2, X } from 'lucide-react';
import { reservationHoldTime } from '../../utils/reservationHolds';

function tableId(table) {
  return table?.maBan ?? table?.id;
}

function tableName(table) {
  return table?.tenBan || `Bàn ${tableId(table)}`;
}

function tableArea(table) {
  return table?.khuVuc?.tenKhuVuc
    || table?.tenKhuVuc
    || (typeof table?.khuVuc === 'string' ? table.khuVuc : '')
    || table?.tang
    || 'Khu vực chung';
}

function tableCapacity(table) {
  return Number(table?.sucChua ?? table?.soCho ?? table?.soLuongCho ?? 4);
}

function isGrouped(table) {
  return Boolean(table?.maNhomBan || table?.maBanChinh || table?.dangGhepBan);
}

function isEmpty(table) {
  return String(table?.trangThai || 'TRONG').toUpperCase() === 'TRONG';
}

function isServing(table) {
  return String(table?.trangThai || '').toUpperCase() === 'DANG_SU_DUNG';
}

const MODE_META = {
  transfer: {
    title: 'Chuyển bàn',
    description: 'Chuyển toàn bộ đơn đang phục vụ sang một bàn trống khác.',
    confirmText: 'Xác nhận chuyển',
    Icon: ArrowRightLeft,
  },
  merge: {
    title: 'Ghép bàn',
    description: 'Chọn bàn trống hoặc bàn đang phục vụ cùng khu vực. Các đơn đã phát sinh của từng bàn vẫn được giữ nguyên và các bàn được liên kết vào cùng một nhóm phục vụ.',
    confirmText: 'Xác nhận ghép',
    Icon: Link2,
  },
  unmerge: {
    title: 'Tách bàn',
    description: 'Chọn một bàn đưa ra khỏi nhóm hiện tại. Đơn và món của bàn được giữ nguyên; bàn đó sẽ thanh toán riêng.',
    confirmText: 'Xác nhận tách',
    Icon: Unlink2,
  },
};

export default function TableArrangementModal({
  open,
  mode = 'transfer',
  sourceTable,
  tables = [],
  loading = false,
  reservationHolds = new Map(),
  onClose,
  onSubmit,
}) {
  const [targetId, setTargetId] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [detachedId, setDetachedId] = useState('');
  const meta = MODE_META[mode] || MODE_META.transfer;
  const Icon = meta.Icon;
  const sourceGrouped = isGrouped(sourceTable);
  const sourceGroupId = sourceTable?.maNhomBan;
  const groupMembers = useMemo(() => {
    if (!sourceGrouped || !sourceGroupId) return sourceTable ? [sourceTable] : [];
    return tables
      .filter((table) => String(table?.maNhomBan ?? '') === String(sourceGroupId))
      .sort((a, b) => tableName(a).localeCompare(tableName(b), 'vi'));
  }, [tables, sourceTable, sourceGrouped, sourceGroupId]);
  const groupPrimary = groupMembers.find((table) => String(tableId(table)) === String(sourceTable?.maBanChinh)) || sourceTable;
  const extendingGroup = mode === 'merge' && sourceGrouped;

  useEffect(() => {
    if (!open) return;
    setTargetId('');
    setSelectedIds([]);
    setDetachedId(mode === 'unmerge' ? String(tableId(sourceTable) ?? '') : '');
  }, [open, mode, sourceTable]);

  const candidates = useMemo(() => {
    const sourceId = tableId(sourceTable);
    const sourceArea = tableArea(groupPrimary || sourceTable);
    const sourceIsServing = groupMembers.some(isServing);
    return tables
      .filter((table) => tableId(table) !== sourceId)
      // Không cho chọn lại bàn đang ở trong nhóm hiện tại và cũng không cho
      // gộp trực tiếp với một nhóm bàn khác. Backend chỉ nhận bàn độc lập.
      .filter((table) => !isGrouped(table))
      .filter((table) => {
        if (mode !== 'merge') return isEmpty(table);
        // Backend chỉ cho ghép hai bàn đang có đơn khi bàn chính cũng đang phục vụ.
        // Bàn đang chờ thanh toán không được ghép thêm.
        return isEmpty(table) || (sourceIsServing && isServing(table));
      })
      .filter((table) => mode !== 'merge' || tableArea(table) === sourceArea)
      .sort((a, b) => tableName(a).localeCompare(tableName(b), 'vi'));
  }, [tables, sourceTable, mode, groupMembers, groupPrimary]);

  const dialogTitle = extendingGroup ? 'Thêm bàn vào nhóm' : meta.title;
  const dialogDescription = extendingGroup
    ? 'Chọn bàn trống hoặc bàn đang phục vụ cùng khu vực để thêm vào nhóm hiện tại. Bàn chính và các đơn đã phát sinh vẫn được giữ nguyên.'
    : meta.description;
  const confirmText = extendingGroup ? 'Xác nhận thêm bàn' : meta.confirmText;
  const detachedTable = mode === 'unmerge'
    ? groupMembers.find((table) => String(tableId(table)) === String(detachedId)) || null
    : null;
  const remainingAfterDetach = mode === 'unmerge' && detachedTable
    ? groupMembers.filter((table) => String(tableId(table)) !== String(detachedId))
    : groupMembers;

  function holdFor(table) {
    return reservationHolds?.get?.(String(tableId(table))) || null;
  }

  if (!open || !sourceTable) return null;

  function close() {
    if (!loading) onClose?.();
  }

  function toggleTable(id) {
    const table = tables.find((item) => String(tableId(item)) === String(id));
    // Lịch đặt chỉ khóa bàn đang trống. Bàn đang phục vụ vẫn có thể được ghép
    // mà không làm mất các đơn đã phát sinh của từng bàn.
    if (table && isEmpty(table) && reservationHolds?.has?.(String(id))) return;
    setSelectedIds((current) => current.includes(id)
      ? current.filter((value) => value !== id)
      : [...current, id]);
  }

  function submit(event) {
    event.preventDefault();
    if (mode === 'transfer') {
      if (!targetId) return;
      onSubmit?.(Number(targetId));
      return;
    }
    if (mode === 'merge') {
      if (!selectedIds.length) return;
      onSubmit?.(selectedIds.map(Number));
      return;
    }
    if (mode === 'unmerge') {
      if (!detachedId) return;
      onSubmit?.(Number(detachedId));
    }
  }

  const canSubmit = (mode === 'unmerge' && Boolean(detachedId))
    || (mode === 'transfer' && Boolean(targetId))
    || (mode === 'merge' && selectedIds.length > 0);

  return (
    <div className="table-arrangement-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <form className="table-arrangement-modal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <header>
          <div className="table-arrangement-heading">
            <span><Icon size={21} /></span>
            <div>
              <h3>{dialogTitle}</h3>
              <p>{dialogDescription}</p>
            </div>
          </div>
          <button type="button" className="table-arrangement-close" onClick={close} disabled={loading} aria-label="Đóng">
            <X size={19} />
          </button>
        </header>

        <div className="table-arrangement-source">
          <span><Table2 size={18} /></span>
          <div>
            <small>{mode === 'unmerge' ? 'Nhóm hiện tại' : mode === 'merge' ? (extendingGroup ? 'Nhóm hiện tại' : 'Bàn chính') : 'Bàn nguồn'}</small>
            <strong>{mode === 'unmerge' || extendingGroup ? groupMembers.map(tableName).join(' + ') : tableName(sourceTable)}</strong>
            <p>
              {tableArea(groupPrimary || sourceTable)} · {tableCapacity(groupPrimary || sourceTable)} chỗ
              {mode === 'unmerge' || extendingGroup ? ` · Bàn chính: ${tableName(groupPrimary)}` : ''}
            </p>
          </div>
        </div>

        {mode === 'transfer' ? (
          <label className="table-arrangement-select">
            <span>Bàn đích</span>
            <select value={targetId} onChange={(event) => setTargetId(event.target.value)} required>
              <option value="">Chọn bàn trống</option>
              {candidates.map((table) => {
                const hold = holdFor(table);
                return (
                  <option key={tableId(table)} value={tableId(table)} disabled={Boolean(hold)}>
                    {tableName(table)} · {tableCapacity(table)} chỗ · {tableArea(table)}{hold ? ` · Đã đặt ${reservationHoldTime(hold)}` : ''}
                  </option>
                );
              })}
            </select>
            {!candidates.length ? <small>Không có bàn trống độc lập để chuyển đến.</small> : candidates.some(holdFor) ? <small className="reservation-hold-note">Bàn có lịch đặt sắp tới được khóa để tránh trùng giờ.</small> : null}
          </label>
        ) : null}

        {mode === 'merge' ? (
          <div className="table-arrangement-options">
            <div className="table-arrangement-options-head">
              <span>{extendingGroup ? 'Chọn bàn thêm vào nhóm' : 'Chọn bàn ghép'}</span>
              <small>{selectedIds.length} bàn đã chọn</small>
            </div>
            <div className="table-arrangement-option-list">
              {candidates.map((table) => {
                const id = tableId(table);
                const checked = selectedIds.includes(id);
                const hold = holdFor(table);
                const unavailable = Boolean(hold && isEmpty(table));
                const serving = isServing(table);
                return (
                  <label key={id} className={`${checked ? 'selected' : ''} ${unavailable ? 'unavailable' : ''}`.trim()}>
                    <input type="checkbox" checked={checked} disabled={unavailable} onChange={() => toggleTable(id)} />
                    <span><Table2 size={17} /></span>
                    <div>
                      <strong>{tableName(table)}</strong>
                      <small>
                        {unavailable
                          ? `Đã đặt lúc ${reservationHoldTime(hold)} · Không thể ghép`
                          : serving
                            ? `${tableArea(table)} · ${tableCapacity(table)} chỗ · Đang phục vụ · Giữ nguyên đơn hiện có`
                            : `${tableArea(table)} · ${tableCapacity(table)} chỗ · Bàn trống`}
                      </small>
                    </div>
                  </label>
                );
              })}
              {!candidates.length ? <div className="table-arrangement-empty">{extendingGroup ? 'Không có bàn độc lập phù hợp để thêm vào nhóm.' : 'Không có bàn phù hợp cùng khu vực để ghép.'}</div> : null}
            </div>
          </div>
        ) : null}

        {mode === 'unmerge' ? (
          <>
            <div className="table-arrangement-options">
              <div className="table-arrangement-options-head">
                <span>Chọn bàn muốn tách</span>
                <small>{detachedTable ? tableName(detachedTable) : 'Chưa chọn'}</small>
              </div>
              <div className="table-arrangement-option-list">
                {groupMembers.map((table) => {
                  const id = tableId(table);
                  const checked = String(detachedId) === String(id);
                  return (
                    <label key={id} className={checked ? 'selected' : ''}>
                      <input
                        type="radio"
                        name="detachedTable"
                        value={id}
                        checked={checked}
                        onChange={() => setDetachedId(String(id))}
                      />
                      <span><Table2 size={17} /></span>
                      <div>
                        <strong>{tableName(table)}{String(tableId(groupPrimary)) === String(id) ? ' · Bàn chính' : ''}</strong>
                        <small>
                          {isServing(table)
                            ? 'Đang phục vụ · Giữ nguyên đơn và món hiện có'
                            : isEmpty(table)
                              ? 'Bàn trống · Tách khỏi nhóm hiện tại'
                              : `${String(table?.trangThai || '').replaceAll('_', ' ')} · Tách khỏi nhóm hiện tại`}
                        </small>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="table-arrangement-warning">
              {detachedTable
                ? groupMembers.length === 2
                  ? `Sau khi tách ${tableName(detachedTable)}, nhóm sẽ được giải thể. ${groupMembers.map(tableName).join(' và ')} trở lại hoạt động và thanh toán độc lập; đơn/món hiện có vẫn được giữ nguyên.`
                  : `${tableName(detachedTable)} sẽ ra khỏi nhóm và thanh toán riêng. ${remainingAfterDetach.map(tableName).join(' + ')} vẫn thuộc cùng nhóm và tiếp tục thanh toán chung.`
                : 'Chọn một bàn để xem kết quả sau khi tách.'}
            </div>
          </>
        ) : null}

        <footer>
          <button type="button" onClick={close} disabled={loading}>Hủy bỏ</button>
          <button type="submit" className="primary" disabled={loading || !canSubmit}>
            <Icon size={17} />{loading ? 'Đang xử lý...' : confirmText}
          </button>
        </footer>
      </form>
    </div>
  );
}
