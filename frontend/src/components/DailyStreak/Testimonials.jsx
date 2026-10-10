import React, { useEffect, useRef } from 'react';
import { Star } from 'lucide-react';

export default function Testimonials() {
  const sectionRef = useRef(null);

  useEffect(() => {
    if (window.gsap && window.ScrollTrigger) {
      const quotes = sectionRef.current.querySelectorAll('.testimonial-item');
      window.gsap.fromTo(quotes,
        { scale: 0.8, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: 0.5,
          stagger: 0.2,
          ease: "back.out(1.7)",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 75%",
          }
        }
      );
    }
  }, []);

  return (
    <div ref={sectionRef} style={{ padding: '3rem 0', textAlign: 'center' }}>
      <h2 style={{ fontSize: '2rem', marginBottom: '2rem' }}>Recent Winners</h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '2rem'
      }}>
        {[
          { name: "Rahul S.", prize: "₹500 Amazon Gift Card", comment: "Just claimed my Day 7 reward. Completely legit!" },
          { name: "Priya M.", prize: "300 VEs Coins", comment: "The daily check-in is so addictive. Building my stash fast." },
          { name: "Vikram K.", prize: "₹100 Amazon Gift Card", comment: "Easiest rewards ever. Don't break your streak!" }
        ].map((t, i) => (
          <div key={i} className="testimonial-item glass-panel" style={{ padding: '1.5rem', textAlign: 'left' }}>
            <div style={{ display: 'flex', color: 'var(--color-accent)', marginBottom: '0.5rem' }}>
              <Star size={16} fill="var(--color-accent)" /><Star size={16} fill="var(--color-accent)" /><Star size={16} fill="var(--color-accent)" /><Star size={16} fill="var(--color-accent)" /><Star size={16} fill="var(--color-accent)" />
            </div>
            <p style={{ fontStyle: 'italic', color: '#eee', marginBottom: '1rem' }}>"{t.comment}"</p>
            <div style={{ fontWeight: 'bold' }}>{t.name}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-success)' }}>Won: {t.prize}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
