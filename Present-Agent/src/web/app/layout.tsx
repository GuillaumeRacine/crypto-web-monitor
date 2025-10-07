import "./globals.css";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import { WishlistProvider } from "../components/wishlist/WishlistContext";

export const metadata = {
  title: "Present Agent",
  description: "AI gift recommendation assistant",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 antialiased flex flex-col">
        <WishlistProvider>
          <Header />
          <div className="flex-1">{children}</div>
          <Footer />
        </WishlistProvider>
      </body>
    </html>
  );
}
