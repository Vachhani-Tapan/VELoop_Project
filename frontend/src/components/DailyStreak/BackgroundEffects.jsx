import React, { useEffect, useRef } from 'react';

export default function BackgroundEffects() {
  const containerRef = useRef(null);

  useEffect(() => {
    // Only run if gsap is available
    if (!window.gsap) return;
    
    const orbs = containerRef.current.querySelectorAll('.orb');
    
    orbs.forEach((orb, i) => {
      gsap.to(orb, {
        x: () => Math.random() * 200 - 100,
        y: () => Math.random() * 200 - 100,
        duration: () => 5 + Math.random() * 5,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: i * 0.5
      });
    });
  }, []);

  return (
    <div ref={containerRef} style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      pointerEvents: 'none',
      zIndex: -1,
      overflow: 'hidden'
    }}>
      <div className="orb" style={{
        position: 'absolute', top: '10%', left: '20%',
        width: '300px', height: '300px',
        background: 'radial-gradient(circle, rgba(138,43,226,0.15) 0%, rgba(0,0,0,0) 70%)',
        borderRadius: '50%',
        filter: 'blur(40px)'
      }} />
      <div className="orb" style={{
        position: 'absolute', top: '60%', right: '10%',
        width: '400px', height: '400px',
        background: 'radial-gradient(circle, rgba(255,215,0,0.1) 0%, rgba(0,0,0,0) 70%)',
        borderRadius: '50%',
        filter: 'blur(50px)'
      }} />
      <div className="orb" style={{
        position: 'absolute', bottom: '-10%', left: '30%',
        width: '250px', height: '250px',
        background: 'radial-gradient(circle, rgba(0,210,106,0.1) 0%, rgba(0,0,0,0) 70%)',
        borderRadius: '50%',
        filter: 'blur(40px)'
      }} />
    </div>
  );
}
