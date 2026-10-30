import PublicMap from './features/public/PublicMap.jsx';
import CampusPhoto from './components/CampusPhoto.jsx';
import React from 'react';
import { Bus, MapPin, Users, Navigation } from 'lucide-react';
import './landing.css';

export default function Landing() {
  return <div className="landing">
    <header className="landing-nav"><a className="landing-logo" href="#">oau<span>transit.</span></a><nav aria-label="Main navigation"><a href="#live-map">Live map</a><a href="#how-it-works">How it works</a><a href="#campus">Our campus</a></nav><a className="landing-button dark small" href="#app">Open app </a></header>
    <section className="landing-hero">
      <div className="hero-copy"><span className="landing-kicker"><span/> MADE FOR LIFE ON CAMPUS</span><h1>Less waiting.<br/>More moving.</h1><p>Find campus shuttles. Check your stop. Report a queue.</p><a className="landing-button dark" href="#live-map">Find your next shuttle </a><div className="hero-location"><MapPin size={15}/> Obafemi Awolowo University, Ile-Ife</div></div>
      <div className="hero-photo"><CampusPhoto/><div className="photo-label"><span className="label-icon"><Bus size={23}/></span><div>Your campus. Your next stop.<small>Campus transport, better connected.</small></div></div><span className="photo-corner">OAU / ILE-IFE</span></div>
    </section>
    <PublicMap/>
    <section className="landing-how" id="how-it-works"><div className="section-intro"><span className="landing-kicker">A SIMPLER WAY AROUND</span><h2>Get going.<br/>In three simple steps.</h2></div><div className="landing-steps">{[{icon:MapPin,title:'Choose your stop',text:'Open the app and find the campus stop you’re heading to.'},{icon:Users,title:'Let us know the queue',text:'At the stop? Share how busy it is so the transport office has a clearer picture.'},{icon:Bus,title:'Check the status',text:'See whether a shuttle has been dispatched to your stop.'}].map((step,i)=><article key={step.title}><div className="step-top"><step.icon size={26}/><span>0{i+1}</span></div><h3>{step.title}</h3><p>{step.text}</p></article>)}</div></section>
    <section className="landing-campus" id="campus"><div className="campus-image"><CampusPhoto aerial/><span className="campus-caption">THE CAMPUS WE CALL HOME.</span></div><div className="campus-copy"><span className="landing-kicker">BUILT AROUND OAU</span><h2>Big campus.<br/>Better connections.</h2><p>Students share what’s happening at stops. Drivers share their location during shifts. The transport office brings it together to decide where the next shuttle goes.</p><a className="landing-text-link" href="#live-map">Explore campus stops </a></div></section>
    <section className="landing-staff"><div><Navigation size={25}/><h3>Keeping campus moving?</h3><p>Access your transport workspace.</p></div><div className="landing-sign-in-links"><a className="landing-button light" href="#app/admin">Admin sign in </a><a className="landing-button light" href="#app/driver">Driver sign in </a></div></section>
    <footer className="landing-footer"><a href="#demo/admin">Admin demo</a><a href="#demo/student">Student demo</a><a className="landing-logo" href="#">oau<span>transit.</span></a><p>Campus transport. Connected.</p><span>Obafemi Awolowo University · Ile-Ife</span></footer>
  </div>;
}
