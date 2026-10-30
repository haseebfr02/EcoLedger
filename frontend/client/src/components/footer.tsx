import { Link } from "wouter";

export default function Footer() {
  return (
    <footer className="bg-white text-black py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
          <div className="max-w-sm">
            <div className="flex items-center space-x-3">
              <img
                src="/main-logo.png"
                alt="EcoRegister Logo"
                className="w-12 h-12 object-contain"
              />
              <span className="text-2xl font-bold text-foreground">
                EcoLedger
              </span>
            </div>

            <p className="text-gray-700 mt-4">
              Making carbon offsetting accessible, transparent, and impactful for everyone.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-6">Marketplace</h4>
            <ul className="space-y-3 text-gray-700">
              <li>
                <Link href="/marketplace" className="hover:text-primary transition-colors" data-testid="link-browse-credits">
                  Browse Credits
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-200 mt-12 pt-8">
          <p className="text-gray-700 text-sm">© 2026 EcoLedger. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
