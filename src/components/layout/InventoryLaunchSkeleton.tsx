import Header from "./Header";

export default function InventoryLaunchSkeleton() {
  return (
    <div className="app-viewport atelier-app launch-pending-frame" dir="rtl">
      <Header />
      <main className="inventory-home launch-pending-content" aria-busy="true">
        <span className="sr-only" role="status">جارٍ تحميل التطبيق</span>
        <div className="home-welcome" aria-hidden="true">
          <span className="launch-skeleton-bar launch-skeleton-greeting" />
        </div>
        <div className="home-search-glass" aria-hidden="true">
          <span className="launch-skeleton-bar launch-skeleton-search" />
        </div>
        <div className="home-stats" aria-hidden="true">
          {[0, 1, 2, 3].map(index => <span className="launch-skeleton-bar launch-skeleton-stat" key={index} />)}
        </div>
        <section className="home-categories-section" aria-hidden="true">
          <span className="launch-skeleton-bar launch-skeleton-heading" />
          <div className="launch-skeleton-categories">
            {[0, 1, 2].map(index => <span className="launch-skeleton-bar launch-skeleton-card" key={index} />)}
          </div>
        </section>
        <section className="home-activity-section" aria-hidden="true">
          <span className="launch-skeleton-bar launch-skeleton-heading" />
          {[0, 1].map(index => <span className="launch-skeleton-bar launch-skeleton-row" key={index} />)}
        </section>
      </main>
      <div className="atelier-nav launch-skeleton-nav" aria-hidden="true">
        <div className="atelier-nav-glass">
          {[0, 1, 2, 3, 4].map(index => <span className="launch-skeleton-bar launch-skeleton-dot" key={index} />)}
        </div>
      </div>
    </div>
  );
}
