'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function BlockRenderer({ blocks = [] }) {
  if (!Array.isArray(blocks)) return null;

  return (
    <div className="flex flex-col gap-12 w-full">
      {blocks
        .filter(b => b.visible !== false)
        .map(block => {
          switch (block.type) {
            case 'hero':
              return <HeroBlock key={block.id} configs={block.configs} />;
            case 'terminal':
              return <TerminalBlock key={block.id} configs={block.configs} />;
            case 'features':
              return <FeaturesBlock key={block.id} configs={block.configs} />;
            case 'cta':
              return <CtaBlock key={block.id} configs={block.configs} />;
            case 'faq':
              return <FaqBlock key={block.id} configs={block.configs} />;
            case 'signup':
              return <SignupBlock key={block.id} configs={block.configs} />;
            case 'posts':
              return <RecentPostsBlock key={block.id} configs={block.configs} />;
            case 'pricing':
              return <PricingBlock key={block.id} configs={block.configs} />;
            case 'testimonials':
              return <TestimonialsBlock key={block.id} configs={block.configs} />;
            case 'stats':
              return <StatsBlock key={block.id} configs={block.configs} />;
            case 'html':
              return <HtmlBlock key={block.id} configs={block.configs} />;
            default:
              return null;
          }
        })}
    </div>
  );
}

// Helper to highlight numbers/symbols inside metrics/bullet texts
function renderMetricText(text) {
  if (!text) return null;
  const parts = text.split('•');
  return parts.map((part, idx) => {
    const trimmed = part.trim();
    const words = trimmed.split(/\s+/);
    return (
      <span key={idx} style={{ display: 'inline-flex', alignItems: 'center' }}>
        <span>
          {words.map((w, wIdx) => {
            const isHighlight = /\d/.test(w) || w.includes('×') || w.includes('x') || w.includes('%');
            return (
              <span key={wIdx}>
                {isHighlight ? <strong>{w}</strong> : w}
                {wIdx < words.length - 1 ? ' ' : ''}
              </span>
            );
          })}
        </span>
        {idx < parts.length - 1 ? <span style={{ margin: '0 12px', color: 'var(--muted)' }}>•</span> : null}
      </span>
    );
  });
}

// 1. Hero Block
function HeroBlock({ configs = {} }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isCliCommand = configs.buttonLink && (configs.buttonLink.startsWith('npm i') || configs.buttonLink.startsWith('npx'));

  return (
    <section className="hero" style={{ padding: '60px 0 40px' }}>
      {configs.tagText && (
        <div className="hero-banner">
          {configs.tag && <span>{configs.tag}</span>}
          <span>{configs.tagText}</span>
          {configs.tagLink && <a href={configs.tagLink}>Read article →</a>}
        </div>
      )}

      <h1>{configs.title || 'Command Code Headline'}</h1>
      {configs.description && <p className="hero-desc">{configs.description}</p>}

      <div className="hero-cta" style={{ justifyContent: 'center', marginTop: '24px' }}>
        {configs.buttonText && (
          isCliCommand ? (
            <button className="cli-command" onClick={() => copyToClipboard(configs.buttonLink)} title="Click to copy" style={{ cursor: 'pointer' }}>
              {copied ? '✓ Copied!' : configs.buttonText} 📋
            </button>
          ) : (
            <Link href={configs.buttonLink || '#'} className="btn btn-primary" style={{ padding: '12px 28px' }}>
              {configs.buttonText}
            </Link>
          )
        )}
        {configs.secondaryButtonText && (
          <Link href={configs.secondaryButtonLink || '#'} className="btn btn-secondary" style={{ padding: '12px 28px' }}>
            {configs.secondaryButtonText}
          </Link>
        )}
      </div>

      {configs.metricsText && (
        <div className="hero-metrics" style={{ marginTop: '24px' }}>
          {renderMetricText(configs.metricsText)}
        </div>
      )}
    </section>
  );
}

// 2. Terminal Console Animation Block
function TerminalBlock({ configs = {} }) {
  const [terminalLineIndex, setTerminalLineIndex] = useState(0);
  const defaultLines = [
    { type: 'input', text: '> Build a cli to tell date' },
    { type: 'info', text: 'Building date-cli, checking your taste... [ npx taste pull ]' },
    { type: 'highlight', text: 'Using your taste, I see you prefer:' },
    { type: 'highlight', text: '  ◻ TypeScript for CLI' },
    { type: 'highlight', text: '  ◻ Commander and tsup' },
    { type: 'highlight', text: '  ◻ Vitest for unit tests' },
    { type: 'info', text: 'Applying preferences and building...' },
    { type: 'success', text: '✓ Done! Created CLI linked using npm link.' },
    { type: 'success', text: '✓ Run date-cli in your shell to try it out!' }
  ];
  
  const terminalLines = configs.lines || defaultLines;

  useEffect(() => {
    const timer = setInterval(() => {
      setTerminalLineIndex(prev => {
        if (prev < terminalLines.length) {
          return prev + 1;
        }
        return 1; // loop
      });
    }, 2200);

    return () => clearInterval(timer);
  }, [terminalLines.length]);

  return (
    <section className="comparison-section" style={{ padding: '60px 0' }}>
      {configs.tag && <div className="section-tag">{configs.tag}</div>}
      {configs.title && <h2 className="section-title">{configs.title}</h2>}
      {configs.description && <p className="section-desc">{configs.description}</p>}

      <div className="comparison-grid">
        {/* Left Console: Without Taste */}
        <div className="console-box">
          <div className="console-header">
            <div className="console-dots">
              <span className="dot-red"></span>
              <span className="dot-yellow"></span>
              <span className="dot-green"></span>
            </div>
            <div className="console-title">{configs.leftTitle || 'other-agents.log'}</div>
            <span></span>
          </div>
          <div className="console-body">
            <span className="text-prompt">[ PROMPT ] &gt; Build a cli to tell date</span>
            <span className="text-prompt">✳ Building...</span>
            <span className="text-wrong">[ WRONG ] Interrupted: no, please use typescript</span>
            <span className="text-prompt">✳ Blabbering... Adding tsc config</span>
            <span className="text-wrong">[ WRONG ] Interrupted: use tsup, not raw tsc</span>
            <span className="text-prompt">✳ Stuck in loops... adding Mocha tests</span>
            <span className="text-wrong">[ WRONG ] Interrupted: I prefer vitest</span>
            <span className="text-wrong">Sloppy AI: "Leave it, I will do it myself!"</span>
          </div>
        </div>

        {/* Right Console: With Taste */}
        <div className="console-box with-taste">
          <div className="console-header">
            <div className="console-dots">
              <span className="dot-red"></span>
              <span className="dot-yellow"></span>
              <span className="dot-green"></span>
            </div>
            <div className="console-title">{configs.rightTitle || 'command-code.log'}</div>
            <span className="text-success">active</span>
          </div>
          <div className="console-body">
            {terminalLines.slice(0, terminalLineIndex).map((line, i) => (
              <span
                key={i}
                className={
                  line.type === 'input'
                    ? 'text-prompt'
                    : line.type === 'success'
                    ? 'text-success'
                    : line.type === 'highlight'
                    ? 'text-highlight'
                    : ''
                }
              >
                {line.text}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// 3. Features Block
function FeaturesBlock({ configs = {} }) {
  return (
    <section className="features-section" style={{ padding: '60px 0' }}>
      {configs.tag && <div className="section-tag">{configs.tag}</div>}
      {configs.title && <h2 className="section-title">{configs.title}</h2>}
      {configs.description && <p className="section-desc">{configs.description}</p>}
      <div className="grid-features" style={{ marginTop: '40px' }}>
        {(configs.items || []).map((item, idx) => (
          <div key={idx} className="feature-card">
            <span className="feature-num">{(idx + 1).toString().padStart(2, '0')}</span>
            <h3>{item.title}</h3>
            <p>{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// 4. CTA Block
function CtaBlock({ configs = {} }) {
  return (
    <section className="pricing-section" style={{ margin: '40px auto' }}>
      <div className="pricing-card" style={{ maxWidth: '750px', padding: '40px 30px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '28px', marginBottom: '20px' }}>{configs.title}</h2>
        {configs.buttonText && (
          <Link href={configs.buttonLink || '#'} className="btn btn-primary" style={{ padding: '12px 32px' }}>
            {configs.buttonText}
          </Link>
        )}
      </div>
    </section>
  );
}

// 5. FAQ Block
function FaqBlock({ configs = {} }) {
  const [activeFaq, setActiveFaq] = useState(null);

  return (
    <section className="faq-section" style={{ padding: '60px 0' }}>
      <div className="faq-layout">
        <div>
          {configs.tag && <div className="section-tag">{configs.tag}</div>}
          <h2>{configs.title || 'FAQ'}</h2>
          {configs.description && (
            <p className="section-desc" style={{ marginTop: '12px' }}>
              {configs.description}
            </p>
          )}
        </div>
        <div className="faq-list">
          {(configs.items || []).map((item, index) => (
            <div key={index} className={`faq-item ${activeFaq === index ? 'active' : ''}`}>
              <button className="faq-question" onClick={() => setActiveFaq(activeFaq === index ? null : index)}>
                {item.q}
              </button>
              {activeFaq === index && (
                <div className="faq-answer">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// 6. Signup Block
function SignupBlock({ configs = {} }) {
  const [email, setEmail] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupStatus, setSignupStatus] = useState({ type: '', message: '' });

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setSignupStatus({ type: 'error', message: 'Please enter a valid email address!' });
      return;
    }

    setSignupLoading(true);
    setSignupStatus({ type: '', message: '' });

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSignupStatus({ type: 'success', message: 'Subscription successful! Welcome to Command Code.' });
        setEmail('');
      } else {
        setSignupStatus({ type: 'error', message: data.error || 'An error occurred.' });
      }
    } catch {
      setSignupStatus({ type: 'error', message: 'Server connection error.' });
    } finally {
      setSignupLoading(false);
    }
  };

  return (
    <section className="pricing-section" style={{ margin: '40px auto' }}>
      <div className="pricing-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '28px', marginBottom: '8px' }}>{configs.title || 'Subscribe'}</h2>
        {configs.description && (
          <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '24px' }}>
            {configs.description}
          </p>
        )}

        <form onSubmit={handleSignupSubmit} style={{ display: 'flex', gap: '8px', maxWidth: '420px', margin: '0 auto 16px' }}>
          <input
            type="email"
            placeholder="Enter your email address..."
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border)',
              borderRadius: '100px',
              padding: '10px 20px',
              color: 'var(--foreground)',
              fontSize: '14px',
              outline: 'none'
            }}
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px' }} disabled={signupLoading}>
            {signupLoading ? 'Sending...' : 'Subscribe'}
          </button>
        </form>

        {signupStatus.message && (
          <div
            style={{
              fontSize: '13px',
              color: signupStatus.type === 'success' ? '#10b981' : '#f43f5e',
              marginTop: '12px'
            }}
          >
            {signupStatus.message}
          </div>
        )}
      </div>
    </section>
  );
}

// 7. Recent Posts Block (supports list layout and grid layout)
function RecentPostsBlock({ configs = {} }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPosts() {
      try {
        const res = await fetch(`/api/posts?status=published&limit=${configs.limit || 3}`);
        if (res.ok) {
          const data = await res.json();
          setPosts(data.posts || []);
        }
      } catch (err) {
        console.error('Failed to fetch posts:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchPosts();
  }, [configs.limit]);

  const isGrid = configs.layoutStyle === 'grid';

  return (
    <section className="features-section" style={{ padding: '60px 0' }}>
      <h2 className="section-title" style={{ textAlign: isGrid ? 'center' : 'left' }}>{configs.title || "Product Updates / Changelog"}</h2>
      {configs.description && (
        <p className="section-desc" style={{ margin: isGrid ? '0 auto 40px' : '0 0 40px', textAlign: isGrid ? 'center' : 'left' }}>
          {configs.description}
        </p>
      )}
      
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', marginTop: '20px' }}>Loading updates...</div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', marginTop: '20px' }}>No updates published yet.</div>
      ) : isGrid ? (
        <div className="grid-features" style={{ marginTop: '40px' }}>
          {posts.map((post) => (
            <div key={post.id} className="feature-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', padding: '24px' }}>
              <div>
                {post.image ? (
                  <img src={post.image} alt={post.title} style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--border)' }} />
                ) : (
                  <div style={{ width: '100%', height: '160px', borderRadius: '8px', marginBottom: '16px', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '24px' }}>
                    ⚡
                  </div>
                )}
                <span className="feature-num" style={{ marginBottom: '8px' }}>
                  {new Date(post.created_at).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'short', day: 'numeric'
                  })}
                </span>
                <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '10px' }}>
                  <Link href={`/posts/${post.slug}`} style={{ color: '#fff', textDecoration: 'none' }}>
                    {post.title}
                  </Link>
                </h3>
                <p style={{ color: 'var(--muted)', fontSize: '13px', lineHeight: '1.5' }}>
                  {post.summary || post.content.replace(/<[^>]*>/g, '').substring(0, 120) + '...'}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '20px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  By <strong>{post.author_name}</strong>
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="changelog-list" style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '30px', maxWidth: '800px', margin: '30px auto 0' }}>
          {posts.map((post) => (
            <div key={post.id} className="feature-card" style={{
              display: 'grid',
              gridTemplateColumns: '180px 1fr',
              gap: '24px',
              textAlign: 'left',
              alignItems: 'start',
              padding: '24px 32px',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary)' }}>
                  {new Date(post.created_at).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'short', day: 'numeric'
                  })}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                  By {post.author_name}
                </span>
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px', color: '#fff', marginTop: 0 }}>
                  <Link href={`/posts/${post.slug}`} style={{ textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }}>
                    {post.title}
                  </Link>
                </h3>
                <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
                  {post.summary || post.content.replace(/<[^>]*>/g, '').substring(0, 180) + '...'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// 8. Pricing Block (supports multi-tier plans and single prominent card)
function PricingBlock({ configs = {} }) {
  const [email, setEmail] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupStatus, setSignupStatus] = useState({ type: '', message: '' });

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setSignupStatus({ type: 'error', message: 'Please enter a valid email address!' });
      return;
    }

    setSignupLoading(true);
    setSignupStatus({ type: '', message: '' });

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSignupStatus({ type: 'success', message: 'Subscription successful! Welcome to Command Code.' });
        setEmail('');
      } else {
        setSignupStatus({ type: 'error', message: data.error || 'An error occurred.' });
      }
    } catch {
      setSignupStatus({ type: 'error', message: 'Server connection error.' });
    } finally {
      setSignupLoading(false);
    }
  };

  const hasPlans = Array.isArray(configs.plans) && configs.plans.length > 0;

  return (
    <section className="pricing-section" style={{ padding: '60px 0' }}>
      {configs.tag && (
        <span className="section-tag" style={{ display: 'block', textAlign: 'center', marginBottom: '12px' }}>
          {configs.tag}
        </span>
      )}
      
      {hasPlans ? (
        <>
          {configs.title && <h2 className="section-title" style={{ textAlign: 'center', marginBottom: '12px' }}>{configs.title}</h2>}
          {configs.description && <p className="section-desc" style={{ margin: '0 auto 40px', textAlign: 'center' }}>{configs.description}</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', justifyContent: 'center', maxWidth: '900px', margin: '0 auto' }}>
            {configs.plans.map((plan, idx) => (
              <div key={idx} className="pricing-card" style={{ flex: '1 1 260px', maxWidth: '340px', margin: '0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontSize: '20px', color: '#fff' }}>{plan.name}</h3>
                  <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '6px' }}>{plan.desc}</p>
                  <div className="price" style={{ margin: '20px 0' }}>{plan.price}</div>
                </div>
                <Link href="/register" className="btn btn-primary" style={{ display: 'flex', width: '100%', padding: '10px 0', borderRadius: '100px', marginTop: '12px' }}>
                  Choose Plan
                </Link>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="pricing-card">
          {configs.title && <h2 style={{ fontSize: '36px', marginBottom: '8px' }}>{configs.title}</h2>}
          {configs.description && <p style={{ color: 'var(--muted)', fontSize: '15px' }}>{configs.description}</p>}
          {(configs.price || configs.period) && (
            <div className="price">
              {configs.price}
              {configs.period && <span style={{ fontSize: '20px', fontWeight: '400', color: 'var(--muted)' }}>{configs.period}</span>}
            </div>
          )}
          {configs.subtext && <p className="price-sub">{configs.subtext}</p>}

          {configs.showSignup && (
            <>
              <form onSubmit={handleSignupSubmit} style={{ display: 'flex', gap: '8px', maxWidth: '420px', margin: '0 auto 24px' }}>
                <input
                  type="email"
                  placeholder="Enter your email address..."
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border)',
                    borderRadius: '100px',
                    padding: '10px 20px',
                    color: 'var(--foreground)',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px' }} disabled={signupLoading}>
                  {signupLoading ? 'Sending...' : 'Subscribe'}
                </button>
              </form>

              {signupStatus.message && (
                <div
                  style={{
                    fontSize: '13px',
                    color: signupStatus.type === 'success' ? '#10b981' : '#f43f5e',
                    marginBottom: '16px'
                  }}
                >
                  {signupStatus.message}
                </div>
              )}
            </>
          )}

          {configs.credits && (
            <div className="price-credits" style={{ marginTop: '24px' }}>
              {configs.credits}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// 9. Testimonials Block
function TestimonialsBlock({ configs = {} }) {
  return (
    <section className="testimonials-section" style={{ padding: '60px 0' }}>
      {configs.tag && <div className="section-tag">{configs.tag}</div>}
      {configs.title && <h2 className="section-title">{configs.title}</h2>}

      <div className="testimonial-grid" style={{ marginTop: '40px' }}>
        {(configs.items || []).map((item, idx) => (
          <div key={idx} className="testimonial-card">
            <p className="quote">{item.quote}</p>
            <div className="author">
              {item.author}
              {item.title && <span>{item.title}</span>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// 10. Stats Block
function StatsBlock({ configs = {} }) {
  return (
    <section className="metrics-section" style={{ padding: '60px 0' }}>
      {configs.tag && <div className="section-tag">{configs.tag}</div>}
      {configs.title && <h2 className="section-title">{configs.title}</h2>}
      {configs.description && <p className="section-desc">{configs.description}</p>}
      <div className="metrics-grid" style={{ marginTop: '40px' }}>
        {(configs.items || []).map((item, idx) => (
          <div key={idx} className="metric-card">
            <div className="metric-val">{item.val}</div>
            <div className="metric-lbl">{item.lbl}</div>
            {item.desc && <div className="metric-desc" style={{ marginTop: '8px' }}>{item.desc}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}

// 11. Html Block
function HtmlBlock({ configs = {} }) {
  return (
    <section className="app-container" style={{ margin: '30px auto', maxWidth: '800px', color: 'var(--foreground)' }}>
      <div dangerouslySetInnerHTML={{ __html: configs.html || '' }} />
    </section>
  );
}



