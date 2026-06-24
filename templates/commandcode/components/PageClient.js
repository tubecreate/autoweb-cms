'use client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BlockRenderer from '@/components/BlockRenderer';

function parsePageLayout(layoutStr) {
  try {
    const parsed = layoutStr ? JSON.parse(layoutStr) : [];
    if (Array.isArray(parsed)) {
      return { pageLayout: '1_col', blocks: parsed };
    }
    return {
      pageLayout: parsed.pageLayout || '1_col',
      blocks: Array.isArray(parsed.blocks) ? parsed.blocks : []
    };
  } catch {
    return { pageLayout: '1_col', blocks: [] };
  }
}

export default function PageClient({ page }) {
  const { pageLayout, blocks } = parsePageLayout(page.layout);
  const mainBlocks = blocks.filter(b => b.col !== 'sidebar');
  const sidebarBlocks = blocks.filter(b => b.col === 'sidebar');

  return (
    <div className="relative min-h-screen bg-black text-white flex flex-col justify-between">
      <div className="glow-bg"></div>
      <div className="noise-overlay"></div>

      <div className="app-container">
        {/* Shared Navbar */}
        <Header />

        {/* Dynamic Page Header */}
        <main style={{ padding: '60px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h1 style={{ fontSize: '38px', fontWeight: '800', letterSpacing: '-0.03em', color: '#fff' }}>
              {page.title}
            </h1>
            {page.description && (
              <p style={{ color: 'var(--muted)', fontSize: '15px', marginTop: '10px', maxWidth: '600px', margin: '10px auto 0' }}>
                {page.description}
              </p>
            )}
          </div>

          {pageLayout === '1_col' ? (
            <BlockRenderer blocks={blocks} />
          ) : (
            <div className="grid-columns-layout" style={{
              display: 'grid',
              gap: '32px',
              width: '100%',
              alignItems: 'start',
              gridTemplateColumns: pageLayout === '2_col_equal' 
                ? '1fr 1fr' 
                : pageLayout === '2_col_left' 
                ? '1fr 2.3fr' 
                : '2.3fr 1fr'
            }}>
              {pageLayout === '2_col_left' ? (
                <>
                  <div className="col-item">
                    <BlockRenderer blocks={sidebarBlocks} />
                  </div>
                  <div className="col-item">
                    <BlockRenderer blocks={mainBlocks} />
                  </div>
                </>
              ) : (
                <>
                  <div className="col-item">
                    <BlockRenderer blocks={mainBlocks} />
                  </div>
                  <div className="col-item">
                    <BlockRenderer blocks={sidebarBlocks} />
                  </div>
                </>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Shared Footer */}
      <Footer />
    </div>
  );
}
