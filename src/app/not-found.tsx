import Link from "next/link";
import { Icon } from "@/components/shared/Icon";

export default function NotFound() {
  return (
    <main className="shell" id="main">
      <div className="status-block">
        <div className="status-medallion">
          <Icon name="search" size={30} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h2>Page not found</h2>
          <p>This page doesn&rsquo;t exist. The passage list has everything the app can open.</p>
        </div>
        <div className="status-actions">
          <Link className="btn-primary" href="/">
            <Icon name="book-open" size={17} />
            Go to passages
          </Link>
        </div>
      </div>
    </main>
  );
}
