import React from 'react';
import { MapPin } from 'lucide-react';

export default function CampusPhoto({ aerial = false }) {
  const [failed, setFailed] = React.useState(false);
  return <div className={`campus-photo ${aerial ? 'aerial' : ''} ${failed ? 'photo-pending' : ''}`}>
    {!failed && <img src={aerial ? '/images/oau-aerial.jpg' : '/images/oau-campus.jpg'} alt={aerial ? 'An aerial view of Obafemi Awolowo University' : 'Obafemi Awolowo University campus'} onError={() => setFailed(true)} />}
    {failed && <span className="photo-fallback"><MapPin size={30}/><span>Obafemi Awolowo University<small>Ile-Ife, Nigeria</small></span></span>}
  </div>;
}

