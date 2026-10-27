import React from 'react';

export default function Badge({ status }) { return <span className={`badge ${status || 'none'}`}><span />{({ available: 'Active', resting: 'Resting', on_trip: 'En route', off_duty: 'Not working', dispatched: 'Dispatched', accepted: 'Accepted', arrived: 'Arrived', departed: 'Departed', cancelled: 'Cancelled', expired: 'Expired', offline: 'Offline' })[status] || 'No dispatch'}</span>; }
