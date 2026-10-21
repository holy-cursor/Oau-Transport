import React from 'react';
import { LEVELS } from '../domain.js';

export default function QueueBadge({ level }) { return <span className={`queue-badge level-${level}`}>{level > 0 && <span className="queue-bars">▂▅▇</span>}{LEVELS[level]}</span>; }
