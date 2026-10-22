import React, { useEffect, useState } from 'react';

export default function DriverAssignment({ vehicle, buses, drivers, activeDispatches, busy, onAssign }) {
  const [driverId, setDriverId] = useState(vehicle.driver_id || '');
  useEffect(() => { setDriverId(vehicle.driver_id || ''); }, [vehicle.id, vehicle.driver_id]);
  const inDispatch = activeDispatches.some(d => d.bus_id === vehicle.id);
  const locked = vehicle.shift_active || vehicle.status !== 'off_duty' || inDispatch;
  const assigned = drivers.find(d => d.id === vehicle.driver_id);
  return <div className="driver-assignment">
    <p><strong>Driver:</strong> {assigned?.email || (vehicle.driver_id ? 'Assigned account' : 'Unassigned')}</p>
    <form onSubmit={e => { e.preventDefault(); onAssign(vehicle.id, driverId || null); }}>
      <label>Assign driver<select value={driverId} disabled={busy || locked} onChange={e => setDriverId(e.target.value)}>
        <option value="">No driver</option>
        {vehicle.driver_id && !assigned && <option value={vehicle.driver_id}>Current assigned account</option>}
        {drivers.map(driver => {
          const other = buses.find(b => b.driver_id === driver.id && b.id !== vehicle.id);
          return <option key={driver.id} value={driver.id} disabled={!!other}>{driver.email}{other ? ` / assigned to ${other.name}` : ''}</option>;
        })}
      </select></label>
      <button className="secondary full" disabled={busy || locked || driverId === (vehicle.driver_id || '')} type="submit">{busy ? 'Saving...' : driverId ? 'Save driver assignment' : 'Remove driver assignment'}</button>
    </form>
    {locked && <small>End the shift and finish or cancel active dispatches before changing drivers.</small>}
  </div>;
}
