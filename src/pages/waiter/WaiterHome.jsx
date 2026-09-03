import { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Clock3, Eye, Link2, Table2, Unlink2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { tableApi } from '../../api/tableApi';
import { orderApi } from '../../api/orderApi';
import TableArrangementModal from '../../components/common/TableArrangementModal';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useToast, errorMessageOf, messageOf } from '../../context/ToastContext';
import { fetchReservationHoldMap, reservationHoldTime } from '../../utils/reservationHolds';
import {
  formatClock,
  isActiveOrder,
  itemCount,
  orderCreatedAt,
  orderGroup,
  orderId,
  statusMeta,
  tableIdOfOrder,
  tableNameOfOrder,
  unwrapList,
  waitLabel,
} from '../../utils/waiterData';

const STATUS_META = {
  empty: { label: 'Trống', tone: 'empty' },
  new: { label: 'Có đơn mới', tone: 'new' },
  serving: { label: 'Đang phục vụ', tone: 'serving' },
  payment: { label: 'Chờ thanh toán', tone: 'payment' },
  reserved: { label: 'Sắp có lịch', tone: 'reserved' },
};

function tableId(table) {
  return table?.maBan ?? table?.id;
}

function displayTableName(table) {
  return table?.tenBan || `Bàn ${tableId(table)}`;
}

function isGrouped(table) {
  return Boolean(table?.maNhomBan || table?.maBanChinh || table?.dangGhepBan);
}

function isPrimaryTable(table) {
  if (!isGrouped(table)) return false;
  if (typeof table?.laBanChinh === 'boolean') return table.laBanChinh;
  return String(tableId(table)) === String(table?.maBanChinh);
}

function primaryTableId(table) {
  return table?.maBanChinh ?? tableId(table);
}

function tableVisualStatus(table, orders, reservationHold) {
  if (orders?.some((order) => orderGroup(order) === 'NEW')) return 'new';
  if (orders?.some((order) => orderGroup(order) === 'PAYMENT')) return 'payment';
  if (orders?.length) return 'serving';
  if (table?.trangThai === 'DANG_THANH_TOAN') return 'payment';
  if (table?.trangThai === 'DANG_SU_DUNG') return 'serving';
  if (reservationHold) return 'reserved';
  return 'empty';
}

function groupRole(table) {
  if (!isGrouped(table)) return '';
  return isPrimaryTable(table) ? 'Bàn chính' : 'Bàn ghép';
}

function canTransfer(table) {
  return !isGrouped(table) && ['DANG_SU_DUNG', 'DANG_THANH_TOAN'].includes(table?.trangThai);
}

function canMerge(table) {
  return !isGrouped(table) && ['TRONG', 'DANG_SU_DUNG'].includes(table?.trangThai || 'TRONG');
}

function canUnmerge(table) {
  return isGrouped(table) && String(table?.trangThai || '').toUpperCase() === 'TRONG';
}

function primaryTableName(table, tables) {
  const primary = tables.find((item) => String(tableId(item)) === String(primaryTableId(table)));
  return primary ? displayTableName(primary) : `Bàn ${primaryTableId(table)}`;
}

export default function WaiterHome() {
  const toast = useToast();
  const event = useWebSocket(['/topic/orders', '/topic/kitchen', '/topic/tables', '/topic/reservations']);
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [reservationHolds, setReservationHolds] = useState(() => new Map());
  const [selectedTable, setSelectedTable] = useState('ALL');
  const [filters, setFilters] = useState({ empty: true, new: true, serving: true, payment: true, reserved: true });
  const [arrangementMode, setArrangementMode] = useState(null);
  const [arrangementLoading, setArrangementLoading] = useState(false);

  async function load(preferredTable) {
    try {
      const [tableResponse, orderResponse, holdMap] = await Promise.all([
        tableApi.getAll(),
        orderApi.getAll().catch(() => []),
        fetchReservationHoldMap().catch(() => new Map()),
      ]);
      const nextTables = unwrapList(tableResponse);
      setTables(nextTables);
      setOrders(unwrapList(orderResponse));
      setReservationHolds(holdMap);
      if (preferredTable !== undefined && preferredTable !== null) {
        setSelectedTable(String(preferredTable));
      } else if (selectedTable !== 'ALL' && !nextTables.some((table) => String(tableId(table)) === String(selectedTable))) {
        setSelectedTable('ALL');
      }
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không tải được dữ liệu bàn ăn'));
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (['/topic/orders', '/topic/kitchen', '/topic/tables', '/topic/reservations'].includes(event?.topic)) load();
  }, [event]);

  const activeOrders = useMemo(() => orders.filter(isActiveOrder), [orders]);
  const ordersByTable = useMemo(() => {
    const map = new Map();
    activeOrders.forEach((order) => {
      const id = String(tableIdOfOrder(order));
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(order);
    });
    map.forEach((rows) => rows.sort((a, b) => new Date(orderCreatedAt(b) || 0) - new Date(orderCreatedAt(a) || 0)));
    return map;
  }, [activeOrders]);

  const tableIdsByGroup = useMemo(() => {
    const map = new Map();
    tables.forEach((table) => {
      if (!table?.maNhomBan) return;
      const key = String(table.maNhomBan);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(String(tableId(table)));
    });
    return map;
  }, [tables]);

  function ordersForTable(table) {
    if (!table) return [];
    if (!isGrouped(table) || !table?.maNhomBan) {
      return ordersByTable.get(String(tableId(table))) || [];
    }
    const ids = tableIdsByGroup.get(String(table.maNhomBan)) || [String(tableId(table))];
    return ids.flatMap((id) => ordersByTable.get(String(id)) || []);
  }

  const selectedTableRow = useMemo(
    () => tables.find((table) => String(tableId(table)) === String(selectedTable)) || null,
    [tables, selectedTable],
  );

  const selectedReservationHold = selectedTableRow ? reservationHolds.get(String(tableId(selectedTableRow))) || null : null;
  const selectedTableHasOrders = selectedTableRow ? (ordersByTable.get(String(tableId(selectedTableRow))) || []).length > 0 : false;

  const shownTables = useMemo(() => tables.filter((table) => {
    const rows = ordersForTable(table);
    return filters[tableVisualStatus(table, rows, reservationHolds.get(String(tableId(table))))];
  }), [tables, ordersByTable, tableIdsByGroup, filters, reservationHolds]);

  const shownOrders = useMemo(() => activeOrders
    .filter((order) => {
      if (selectedTable === 'ALL' || !selectedTableRow) return true;
      if (!isGrouped(selectedTableRow) || !selectedTableRow?.maNhomBan) {
        return String(tableIdOfOrder(order)) === String(tableId(selectedTableRow));
      }
      const ids = tableIdsByGroup.get(String(selectedTableRow.maNhomBan)) || [];
      return ids.includes(String(tableIdOfOrder(order)));
    })
    .sort((a, b) => new Date(orderCreatedAt(b) || 0) - new Date(orderCreatedAt(a) || 0)), [activeOrders, selectedTable, selectedTableRow, tableIdsByGroup]);

  function toggleFilter(key) {
    setFilters((current) => ({ ...current, [key]: !current[key] }));
  }

  async function submitArrangement(value) {
    if (!selectedTableRow || arrangementLoading) return;
    setArrangementLoading(true);
    try {
      let response;
      let preferredId = tableId(selectedTableRow);
      if (arrangementMode === 'transfer') {
        response = await tableApi.transfer(tableId(selectedTableRow), value);
        preferredId = value;
      } else if (arrangementMode === 'merge') {
        response = await tableApi.merge(tableId(selectedTableRow), value);
      } else if (arrangementMode === 'unmerge') {
        response = await tableApi.unmerge(selectedTableRow.maNhomBan);
      } else {
        return;
      }
      toast.success(messageOf(response, arrangementMode === 'transfer' ? 'Chuyển bàn thành công' : arrangementMode === 'merge' ? 'Ghép bàn thành công' : 'Tách bàn thành công'));
      setArrangementMode(null);
      await load(preferredId);
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể cập nhật sắp xếp bàn'));
    } finally {
      setArrangementLoading(false);
    }
  }

  const selectedLabel = selectedTableRow ? displayTableName(selectedTableRow) : '';

  return (
    <section className="waiter-page waiter-table-monitor-page">
      <div className="waiter-card waiter-table-map-card">
        <div className="waiter-table-map-head waiter-table-map-head-no-title">
          <div className="waiter-table-map-tools">
            <div className="waiter-table-arrangement-actions">
              <button type="button" disabled={!selectedTableRow || !canTransfer(selectedTableRow)} title={selectedTableRow && !canTransfer(selectedTableRow) ? 'Chỉ chuyển bàn đang có đơn phục vụ' : ''} onClick={() => setArrangementMode('transfer')}><ArrowRightLeft size={16} /> Chuyển bàn</button>
              <button type="button" disabled={!selectedTableRow || !canMerge(selectedTableRow) || Boolean(selectedReservationHold && !selectedTableHasOrders)} title={selectedTableRow && selectedReservationHold && !selectedTableHasOrders ? `Bàn đã được giữ lúc ${reservationHoldTime(selectedReservationHold)}` : selectedTableRow && !canMerge(selectedTableRow) ? 'Bàn hiện tại không thể ghép' : ''} onClick={() => setArrangementMode('merge')}><Link2 size={16} /> Ghép bàn</button>
              <button type="button" disabled={!selectedTableRow || !canUnmerge(selectedTableRow)} title={selectedTableRow && !canUnmerge(selectedTableRow) ? 'Chỉ tách nhóm khi không còn đơn đang mở' : ''} onClick={() => setArrangementMode('unmerge')}><Unlink2 size={16} /> Tách bàn</button>
            </div>
            <div className="waiter-map-filters">
              {Object.entries(STATUS_META).map(([key, meta]) => (
                <label key={key} className={meta.tone}>
                  <input type="checkbox" checked={filters[key]} onChange={() => toggleFilter(key)} />
                  <i />{meta.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="waiter-room-grid">
          {shownTables.map((table) => {
            const id = tableId(table);
            const tableOrders = ordersForTable(table);
            const hold = reservationHolds.get(String(id));
            const statusKey = tableVisualStatus(table, tableOrders, hold);
            const meta = STATUS_META[statusKey];
            const count = tableOrders.reduce((sum, order) => sum + itemCount(order), 0);
            return (
              <button key={id} className={`waiter-room-table ${meta.tone} ${String(selectedTable) === String(id) ? 'selected' : ''} ${isGrouped(table) ? 'grouped' : ''}`} onClick={() => setSelectedTable((current) => String(current) === String(id) ? 'ALL' : String(id))}>
                <span className="chair top" /><span className="chair bottom" /><span className="chair left" /><span className="chair right" />
                {isGrouped(table) ? <span className={`waiter-table-group-tag ${isPrimaryTable(table) ? 'primary' : 'secondary'}`}>{groupRole(table)}</span> : null}
                <Table2 size={22} />
                <strong>{displayTableName(table)}</strong>
                <small>{tableOrders.length ? `${tableOrders.length} đơn · ${count} món${hold ? ` · Đặt ${reservationHoldTime(hold)}` : ''}` : hold ? `Đã đặt lúc ${reservationHoldTime(hold)}` : isGrouped(table) ? `Dùng chung với ${primaryTableName(table, tables)}` : 'Chưa có đơn'}</small>
                <em>{hold && !tableOrders.length ? `Đã đặt ${reservationHoldTime(hold)}` : meta.label}</em>
              </button>
            );
          })}
          {!shownTables.length ? <div className="waiter-map-empty">Không có bàn phù hợp với bộ lọc.</div> : null}
        </div>
      </div>

      <div className="waiter-card waiter-table-order-list">
        <div className="waiter-table-list-head">
          <div><h3>Danh sách đơn theo bàn</h3><p>{selectedTable === 'ALL' ? 'Tất cả đơn đang hoạt động' : `Đang xem đơn của ${selectedLabel}${isGrouped(selectedTableRow) ? ' và nhóm bàn ghép' : ''}`}</p></div>
          {selectedTable !== 'ALL' ? <button onClick={() => setSelectedTable('ALL')}>Hiển thị tất cả</button> : null}
        </div>
        <div className="waiter-orders-table-wrap">
          <table className="waiter-orders-table waiter-table-monitor-table">
            <thead><tr><th>Bàn</th><th>Mã đơn</th><th>Số món</th><th>Trạng thái</th><th>Thời gian chờ</th><th>Thao tác</th></tr></thead>
            <tbody>
              {shownOrders.map((order) => {
                const meta = statusMeta(order.trangThai);
                const createdAt = orderCreatedAt(order);
                return (
                  <tr key={orderId(order)}>
                    <td><strong>{tableNameOfOrder(order)}</strong></td>
                    <td>#{orderId(order)}</td>
                    <td>{itemCount(order)}</td>
                    <td><span className={`waiter-status-badge ${meta.tone}`}>{meta.label}</span></td>
                    <td><span className="waiter-table-wait"><Clock3 size={15} />{waitLabel(createdAt)} <small>({formatClock(createdAt)})</small></span></td>
                    <td><Link className="waiter-monitor-view" to={`/waiter/orders/${orderId(order)}`}><Eye size={18} /><span>Xem</span></Link></td>
                  </tr>
                );
              })}
              {!shownOrders.length ? <tr><td colSpan="6" className="waiter-empty-cell">Không có đơn hàng đang hoạt động.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>

      <TableArrangementModal
        open={Boolean(arrangementMode)}
        mode={arrangementMode || 'transfer'}
        sourceTable={selectedTableRow}
        tables={tables}
        loading={arrangementLoading}
        reservationHolds={reservationHolds}
        onClose={() => !arrangementLoading && setArrangementMode(null)}
        onSubmit={submitArrangement}
      />
    </section>
  );
}
