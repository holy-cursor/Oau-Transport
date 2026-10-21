import React from 'react';

export default function Badge({ status }) { return <span className={`badge ${status || 'none'}`}><span />{({ available: 'Available', on_trip: 'On trip', off_duty: 'Off duty', dispatched: 'Dispatched', accepted: 'Accepted', arrived: 'Arrived', departed: 'Departed', cancelled: 'Cancelled', expired: 'Expired', offline: 'Offline' })[status] || 'No dispatch'}</span>; }
