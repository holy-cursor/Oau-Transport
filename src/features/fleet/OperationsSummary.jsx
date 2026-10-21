import React from 'react';
import { operations } from '../../operations.js';

export default function OperationsSummary({ buses }) {
  return <section className="panel operations-summary"><div><span className="eyebrow">REPORTED FLEET</span><h2>{operations.buses} buses · {operations.tricycles} tricycles</h2><p>{buses.length} registered in this workspace. Reported totals do not mean all vehicles are running today.</p><small>{operations.source}</small></div><details><summary>How the fleet operates</summary><ul><li>{operations.allocation}</li><li>{operations.coordination}</li><li>{operations.demand}</li><li>{operations.trips}</li></ul><p>Daily active fleet, route list and average trips still need confirmation.</p></details></section>;
}
