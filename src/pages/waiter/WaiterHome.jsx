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
  hasPendingConfirmation,
  isActiveOrder,
  itemCount,
  itemName,
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
  new: { label: 'Chờ xác nhận', tone: 'new' },
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

function tableVisualStatus(table, orders, reservationHold) {
  if (orders?.some((order) => hasPendingConfirmation(order) || ['NEW', 'CONFIRM'].includes(orderGroup(order)))) return 'new';
  if (orders?.some((order) => orderGroup(order) === 'PAYMENT')) return 'payment';
  if (orders?.length) return 'serving';
  if (table?.trangThai === 'DANG_THANH_TOAN') return 'payment';
  if (table?.trangThai === 'DANG_SU_DUNG') return 'serving';
  if (reservationHold) return 'reserved';
  return 'empty';
}

function groupRole(table) {
  if (!isGrouped(table)) return '';
  return isPrimaryTable(table) ? 'Bàn chính' : 'Bàn phụ';
}

function tableCapacity(table) {
  return Number(table?.sucChua ?? table?.soCho ?? table?.soLuongCho ?? 4);
}

function canTransfer(table) {
  return !isGrouped(table) && ['DANG_SU_DUNG', 'DANG_THANH_TOAN'].includes(table?.trangThai);
}

function canMerge(table) {
  return ['TRONG', 'DANG_SU_DUNG'].includes(String(table?.trangThai || 'TRONG').toUpperCase());
}

function groupHasPayment(table, tables) {
  const paymentStatuses = new Set(['DANG_THANH_TOAN', 'CHO_THANH_TOAN']);
  if (!isGrouped(table) || !table?.maNhomBan) {
    return paymentStatuses.has(String(table?.trangThai || '').toUpperCase());
  }
  return tables.some((item) => String(item?.maNhomBan ?? '') === String(table.maNhomBan)
    && paymentStatuses.has(String(item?.trangThai || '').toUpperCase()));
}

function canUnmerge(table) {
  return isGrouped(table) && String(table?.trangThai || '').toUpperCase() === 'TRONG';
}

function compactTableName(table) {
  const name = displayTableName(table);
  return name.replace(/^Bàn\s*/i, '').trim();
}

function groupMembersOf(table, tables) {
  if (!isGrouped(table) || !table?.maNhomBan) return table ? [table] : [];
  return tables
    .filter((item) => String(item?.maNhomBan ?? '') === String(table.maNhomBan))
    .sort((a, b) => displayTableName(a).localeCompare(displayTableName(b), 'vi', { numeric: true }));
}

function groupDisplayName(table, tables) {
  const members = groupMembersOf(table, tables);
  return members.length ? members.map(compactTableName).join(' + ') : compactTableName(table);
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
  const [expandedGroup, setExpandedGroup] = useState(null);

  async function load(preferredTable) {
    try {
      const [tableResponse, orderResponse, holdMap] = await Promise.all([
        tableApi.getAll(),
        orderApi.getWaiterActive().catch(() => []),
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

  const tableById = useMemo(() => {
    const map = new Map();
    tables.forEach((table) => map.set(String(tableId(table)), table));
    return map;
  }, [tables]);

  const groupSummaries = useMemo(() => {
    const summaries = new Map();

    tables.forEach((table) => {
      if (!table?.maNhomBan) return;
      const key = String(table.maNhomBan);
      if (!summaries.has(key)) summaries.set(key, { key, members: [] });
      summaries.get(key).members.push(table);
    });

    summaries.forEach((summary) => {
      summary.members.sort((a, b) => displayTableName(a).localeCompare(displayTableName(b), 'vi', { numeric: true }));
      summary.name = summary.members.map(compactTableName).join(' + ');
      summary.primary = summary.members.find(isPrimaryTable) || summary.members[0] || null;

      const ids = new Set(summary.members.map((table) => String(tableId(table))));
      summary.orders = activeOrders.filter((order) => ids.has(String(tableIdOfOrder(order))));
      summary.itemCount = summary.orders.reduce((sum, order) => sum + itemCount(order), 0);

      const createdTimes = summary.orders
        .map((order) => orderCreatedAt(order))
        .filter(Boolean)
        .map((value) => new Date(value))
        .filter((value) => !Number.isNaN(value.getTime()));
      summary.createdAt = createdTimes.length
        ? new Date(Math.min(...createdTimes.map((value) => value.getTime()))).toISOString()
        : null;

      const priorityOrder = [...summary.orders].sort((a, b) => {
        const priorityDiff = statusMeta(a?.trangThai).priority - statusMeta(b?.trangThai).priority;
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(orderCreatedAt(a) || 0) - new Date(orderCreatedAt(b) || 0);
      })[0];
      summary.meta = priorityOrder
        ? statusMeta(priorityOrder.trangThai)
        : { label: 'Đang phục vụ', tone: 'serving' };

      const mergedItems = new Map();
      summary.orders.forEach((order) => {
        (order?.chiTietDonHang || []).forEach((item) => {
          if (String(item?.trangThaiMon || '').toUpperCase() === 'DA_HUY') return;
          const name = itemName(item);
          const quantity = Number(item?.soLuong || 0);
          mergedItems.set(name, (mergedItems.get(name) || 0) + quantity);
        });
      });
      summary.items = [...mergedItems.entries()]
        .map(([name, quantity]) => ({ name, quantity }))
        .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    });

    return summaries;
  }, [tables, activeOrders]);

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
  const selectedGroupHasPayment = selectedTableRow
    ? groupHasPayment(selectedTableRow, tables) || ordersForTable(selectedTableRow).some((order) => orderGroup(order) === 'PAYMENT')
    : false;

  const statusCounts = useMemo(() => {
    const counts = { empty: 0, new: 0, serving: 0, payment: 0, reserved: 0 };
    tables.forEach((table) => {
      const groupOrders = ordersForTable(table);
      const key = tableVisualStatus(table, groupOrders, reservationHolds.get(String(tableId(table))));
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [tables, ordersByTable, reservationHolds]);

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

  const shownOrderRows = useMemo(() => {
    const rows = [];
    const renderedGroups = new Set();

    shownOrders.forEach((order) => {
      const table = tableById.get(String(tableIdOfOrder(order)));
      const groupKey = table?.maNhomBan ? String(table.maNhomBan) : null;

      if (groupKey && groupSummaries.has(groupKey)) {
        if (renderedGroups.has(groupKey)) return;
        renderedGroups.add(groupKey);
        rows.push({ type: 'group', key: `group-${groupKey}`, summary: groupSummaries.get(groupKey) });
        return;
      }

      rows.push({ type: 'order', key: `order-${orderId(order)}`, order });
    });

    return rows;
  }, [shownOrders, tableById, groupSummaries]);

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
      const mergeSuccess = arrangementMode === 'merge' && isGrouped(selectedTableRow)
        ? 'Thêm bàn vào nhóm thành công'
        : 'Ghép bàn thành công';
      toast.success(messageOf(response, arrangementMode === 'transfer' ? 'Chuyển bàn thành công' : arrangementMode === 'merge' ? mergeSuccess : 'Tách bàn thành công'));
      setArrangementMode(null);
      await load(preferredId);
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể cập nhật sắp xếp bàn'));
    } finally {
      setArrangementLoading(false);
    }
  }

  const selectedLabel = selectedTableRow ? displayTableName(selectedTableRow) : '';
  const selectedGroupName = selectedTableRow && isGrouped(selectedTableRow) ? groupDisplayName(selectedTableRow, tables) : '';
  const selectedGroupSummary = selectedTableRow?.maNhomBan
    ? groupSummaries.get(String(selectedTableRow.maNhomBan)) || null
    : null;
  const selectedContext = !selectedTableRow
    ? 'Chọn một bàn để thực hiện chuyển, ghép hoặc tách bàn.'
    : isGrouped(selectedTableRow)
      ? `Đã chọn Nhóm ${selectedGroupName}`
      : `Đã chọn ${selectedLabel}`;

  return (
    <section className="waiter-page waiter-table-monitor-page">
      <div className="waiter-card waiter-table-map-card">
        <div className="waiter-table-map-head waiter-table-map-head-no-title">
          <div className="waiter-table-map-tools">
            <div className="waiter-table-arrangement-actions">
              <button type="button" disabled={!selectedTableRow || !canTransfer(selectedTableRow)} title={selectedTableRow && !canTransfer(selectedTableRow) ? 'Chỉ chuyển bàn đang có đơn phục vụ' : ''} onClick={() => setArrangementMode('transfer')}><ArrowRightLeft size={16} /> Chuyển bàn</button>
              <button
                type="button"
                disabled={!selectedTableRow || !canMerge(selectedTableRow) || selectedGroupHasPayment || Boolean(selectedReservationHold && !selectedTableHasOrders && !isGrouped(selectedTableRow))}
                title={selectedGroupHasPayment
                  ? 'Nhóm đã bắt đầu thanh toán nên không thể thêm bàn'
                  : selectedTableRow && selectedReservationHold && !selectedTableHasOrders && !isGrouped(selectedTableRow)
                    ? `Bàn đã được giữ lúc ${reservationHoldTime(selectedReservationHold)}`
                    : selectedTableRow && !canMerge(selectedTableRow)
                      ? 'Bàn hiện tại không thể ghép'
                      : ''}
                onClick={() => setArrangementMode('merge')}
              ><Link2 size={16} /> {isGrouped(selectedTableRow) ? 'Thêm bàn' : 'Ghép bàn'}</button>
              <button type="button" disabled={!selectedTableRow || !canUnmerge(selectedTableRow)} title={selectedTableRow && !canUnmerge(selectedTableRow) ? 'Chỉ tách nhóm khi không còn đơn đang mở' : ''} onClick={() => setArrangementMode('unmerge')}><Unlink2 size={16} /> Tách bàn</button>
            </div>
            <div className="waiter-map-filters" aria-label="Lọc trạng thái bàn">
              {Object.entries(STATUS_META).map(([key, meta]) => (
                <button
                  type="button"
                  key={key}
                  className={`${meta.tone} ${filters[key] ? 'active' : ''}`}
                  aria-pressed={filters[key]}
                  onClick={() => toggleFilter(key)}
                >
                  <i />
                  <span>{meta.label}</span>
                  <b>{statusCounts[key] || 0}</b>
                </button>
              ))}
            </div>
            <div className={`waiter-map-selection-note ${selectedTableRow ? 'has-selection' : ''}`}>{selectedContext}</div>
          </div>
        </div>

        <div className="waiter-room-scroll">
          <div className="waiter-room-grid">
            {tables.map((table) => {
              const id = tableId(table);
              const ownOrders = ordersByTable.get(String(id)) || [];
              const hold = reservationHolds.get(String(id));
              const groupOrders = ordersForTable(table);
              const statusKey = tableVisualStatus(table, groupOrders, hold);
              const meta = STATUS_META[statusKey];
              const count = ownOrders.reduce((sum, order) => sum + itemCount(order), 0);
              const grouped = isGrouped(table);
              const groupName = grouped ? groupDisplayName(table, tables) : '';
              const groupSummary = grouped && table?.maNhomBan ? groupSummaries.get(String(table.maNhomBan)) : null;
              const filteredOut = !filters[statusKey];
              return (
                <button
                  key={id}
                  className={`waiter-room-table ${meta.tone} ${String(selectedTable) === String(id) ? 'selected' : ''} ${grouped ? 'grouped' : ''} ${filteredOut ? 'filtered-out' : ''}`}
                  onClick={() => setSelectedTable((current) => String(current) === String(id) ? 'ALL' : String(id))}
                  aria-label={`${displayTableName(table)}, ${tableCapacity(table)} chỗ, ${meta.label}${grouped ? `, nhóm ${groupName}` : ''}`}
                >
                  <span className="chair top" /><span className="chair bottom" /><span className="chair left" /><span className="chair right" />
                  {grouped ? <span className={`waiter-table-group-tag ${isPrimaryTable(table) ? 'primary' : 'secondary'}`}>{groupRole(table)}</span> : null}
                  <Table2 size={22} />
                  <strong>{displayTableName(table)}</strong>
                  <span className="waiter-table-capacity">{tableCapacity(table)} chỗ</span>
                  {!grouped ? <small>{ownOrders.length
                    ? `${ownOrders.length} đơn · ${count} món${hold ? ` · Đặt ${reservationHoldTime(hold)}` : ''}`
                    : hold
                      ? `Đã đặt lúc ${reservationHoldTime(hold)}`
                      : 'Chưa có đơn'}</small> : null}
                  {grouped ? <span className="waiter-table-group-name"><Link2 size={11} /> Nhóm {groupName}</span> : null}
                  <em>{hold && !ownOrders.length ? `Đã đặt ${reservationHoldTime(hold)}` : meta.label}</em>
                </button>
              );
            })}
          </div>
        </div>

        {selectedGroupSummary ? (
          <div className="waiter-group-order-summary" role="status">
            <span className="waiter-group-order-summary-icon"><Link2 size={17} /></span>
            <div>
              <strong>Nhóm bàn {selectedGroupSummary.name}</strong>
              <small>{selectedGroupSummary.members.length} bàn · 1 đơn nhóm · {selectedGroupSummary.itemCount} món</small>
            </div>
          </div>
        ) : null}
      </div>

      <div className="waiter-card waiter-table-order-list">
        <div className="waiter-table-list-head">
          <div>
            <h3>{isGrouped(selectedTableRow) ? `Đơn của nhóm bàn ${selectedGroupName}` : 'Danh sách đơn theo bàn / nhóm bàn'}</h3>
            <p>{selectedTable === 'ALL'
              ? 'Tất cả đơn đang hoạt động'
              : selectedGroupSummary
                ? `1 đơn nhóm · ${selectedGroupSummary.itemCount} món`
                : `Đang xem đơn của ${selectedLabel}`}</p>
          </div>
          {selectedTable !== 'ALL' ? <button onClick={() => setSelectedTable('ALL')}>Hiển thị tất cả</button> : null}
        </div>
        <div className="waiter-orders-table-wrap">
          <table className="waiter-orders-table waiter-table-monitor-table">
            <thead><tr><th>Bàn / nhóm bàn</th><th>Đơn</th><th>Số món</th><th>Trạng thái</th><th>Thời gian chờ</th><th>Thao tác</th></tr></thead>
            <tbody>
              {shownOrderRows.map((row) => {
                if (row.type === 'group') {
                  const { summary } = row;
                  const isExpanded = expandedGroup === summary.key;
                  return [
                    <tr key={row.key} className="waiter-group-order-row">
                      <td>
                        <strong>Nhóm {summary.name}</strong>
                        <small className="waiter-group-order-row-note">{summary.members.length} bàn · Bàn chính: {compactTableName(summary.primary)}</small>
                      </td>
                      <td><span className="waiter-group-order-label">1 đơn nhóm</span></td>
                      <td>{summary.itemCount}</td>
                      <td><span className={`waiter-status-badge ${summary.meta.tone}`}>{summary.meta.label}</span></td>
                      <td><span className="waiter-table-wait"><Clock3 size={15} />{waitLabel(summary.createdAt)} <small>({formatClock(summary.createdAt)})</small></span></td>
                      <td>
                        <button
                          type="button"
                          className="waiter-monitor-view waiter-group-view-button"
                          onClick={() => setExpandedGroup((current) => current === summary.key ? null : summary.key)}
                          aria-expanded={isExpanded}
                        >
                          <Eye size={18} /><span>{isExpanded ? 'Thu gọn' : 'Xem'}</span>
                        </button>
                      </td>
                    </tr>,
                    isExpanded ? (
                      <tr key={`${row.key}-items`} className="waiter-group-order-items-row">
                        <td colSpan="6">
                          <div className="waiter-group-order-items">
                            <strong>Món trong đơn nhóm</strong>
                            <div>
                              {summary.items.length
                                ? summary.items.map((item) => <span key={item.name}>{item.name} <b>×{item.quantity}</b></span>)
                                : <small>Chưa có món trong đơn nhóm.</small>}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null,
                  ];
                }

                const { order } = row;
                const meta = statusMeta(order.trangThai);
                const createdAt = orderCreatedAt(order);
                return (
                  <tr key={row.key}>
                    <td><strong>{tableNameOfOrder(order)}</strong></td>
                    <td>#{orderId(order)}</td>
                    <td>{itemCount(order)}</td>
                    <td><span className={`waiter-status-badge ${meta.tone}`}>{meta.label}</span></td>
                    <td><span className="waiter-table-wait"><Clock3 size={15} />{waitLabel(createdAt)} <small>({formatClock(createdAt)})</small></span></td>
                    <td><Link className="waiter-monitor-view" to={`/waiter/orders/${orderId(order)}`}><Eye size={18} /><span>Xem</span></Link></td>
                  </tr>
                );
              })}
              {!shownOrderRows.length ? <tr><td colSpan="6" className="waiter-empty-cell">Không có đơn hàng đang hoạt động.</td></tr> : null}
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
