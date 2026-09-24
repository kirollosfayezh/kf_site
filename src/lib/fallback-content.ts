/**
 * Static content shown when the API returns nothing *or* cannot be reached.
 *
 * The site must never render an empty shell: a cold-starting Render instance, a
 * network blip and a genuinely empty collection all look the same to a visitor,
 * so they all fall back to this copy. Anything the dashboard publishes wins.
 */

export interface FallbackCard {
  key: string;
  title: string;
  desc: string;
  /** Small label rendered over the card media, where the design has one. */
  tag?: string;
  /** Same Unsplash source the static export used for this card. */
  img?: string;
  alt?: string;
  /** Feature bullets / checklist / tech stack, matching `meta.points`. */
  points?: string[];
  /** Matches `meta.result` on a project. */
  result?: string;
  /** Matches the CMS item slug, so the service icon map still resolves. */
  slug?: string;
  /** Solutions only: the industry eyebrow, which is longer than the Home tag. */
  solutionTag?: string;
  /** Solutions only: the fuller description the Solutions page shows. */
  longDesc?: string;
}

/** Shared Unsplash transform, exactly as the `.dc.html` files spell it. */
const U = "?w=1200&q=80&auto=format&fit=crop";

export const FALLBACK_SERVICES: FallbackCard[] = [
  { key: "custom-software", title: "Custom Software", desc: "Business systems built around your exact requirements.", img: "https://images.unsplash.com/photo-1590402494587-44b71d7772f6" + U, alt: "Two people planning a project on sticky notes" , slug: "custom-software", points: ["Requirements & workflow mapping", "Bespoke architecture", "Built to scale with you"] },
  { key: "web", title: "Web Development", desc: "Fast, responsive and conversion-focused websites and web apps.", img: "https://images.unsplash.com/photo-1542744094-3a31f272c490" + U, alt: "Developer building web interface components" , slug: "web-development", points: ["SEO & performance built in", "Responsive on every device", "CMS & content control"] },
  { key: "mobile", title: "Mobile Applications", desc: "Modern mobile experiences for iOS and Android.", img: "https://images.unsplash.com/photo-1551650975-87deedd944c3" + U, alt: "Phone showing a dashboard app" , slug: "mobile-applications", points: ["iOS & Android from one codebase", "Offline & push support", "App store deployment"] },
  { key: "business-systems", title: "Business Systems", desc: "POS, inventory, HR, dashboards and internal management tools.", img: "https://images.unsplash.com/photo-1551288049-bebda4e38f71" + U, alt: "Performance analytics dashboard on a laptop" , slug: "business-systems", points: ["POS & inventory", "Role-based dashboards", "Reporting & exports"] },
  { key: "automation", title: "Automation", desc: "Replace repetitive manual workflows with smart automation.", img: "https://images.unsplash.com/photo-1647427060118-4911c9821b82" + U, alt: "Robotic arms on an automated production line" , slug: "automation", points: ["Workflow automation", "Scheduled jobs & alerts", "Integrations between tools"] },
  { key: "iot", title: "IoT Solutions", desc: "Connect physical devices, sensors and software.", img: "https://images.unsplash.com/photo-1558002038-1055907df827" + U, alt: "Smart door lock controlled from a phone" , slug: "iot-solutions", points: ["Device & sensor integration", "Real-time telemetry", "Control dashboards"] },
  { key: "ai", title: "AI Solutions", desc: "Integrate AI into real business workflows.", img: "https://images.unsplash.com/photo-1694903110330-cc64b7e1d21d" + U, alt: "Human hand reaching toward a robotic hand" , slug: "ai-solutions", points: ["Chat & assistant features", "Document & data processing", "Model integration"] },
  { key: "api", title: "API & Backend", desc: "Secure, scalable APIs and backend infrastructure.", img: "https://images.unsplash.com/photo-1762163516269-3c143e04175c" + U, alt: "Server rack with status lights" , slug: "api-and-backend", points: ["REST APIs & integrations", "Auth & security", "Databases & hosting"] },
];

export const FALLBACK_SOLUTIONS: FallbackCard[] = [
  { key: "restaurants", tag: "F&B", title: "Restaurants", desc: "POS, ordering systems, inventory and live dashboards.", img: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4" + U, alt: "Busy restaurant dining room" , points: ["POS & order management", "Kitchen display systems", "Live inventory & stock", "Owner dashboards"] , solutionTag: "RESTAURANTS & F&B", longDesc: "Run every branch from one connected system \u2014 take orders faster, keep stock accurate, and see performance in real time." },
  { key: "real-estate", tag: "PROPERTY", title: "Real Estate", desc: "Property websites, listings, lead management and dashboards.", img: "https://images.unsplash.com/photo-1560518883-ce09059eeffa" + U, alt: "Estate agent with clients at a property" , points: ["Property websites & listings", "Lead capture & CRM", "Agent dashboards", "Map & search integration"] , solutionTag: "REAL ESTATE", longDesc: "Turn listings into leads with fast property sites and a back office that keeps every enquiry organised." },
  { key: "retail", tag: "COMMERCE", title: "Retail", desc: "Inventory, sales, customer management and reporting.", img: "https://images.unsplash.com/photo-1441986300917-64674bd600d8" + U, alt: "Retail shop interior with stocked shelves" , points: ["Inventory & sales tracking", "Customer management", "Reporting & analytics", "Multi-branch sync"] , solutionTag: "RETAIL", longDesc: "Know exactly what is selling, what is in stock and who your best customers are \u2014 across every location." },
  { key: "startups", tag: "GROWTH", title: "Startups", desc: "MVP development and scalable product architecture.", img: "https://images.unsplash.com/photo-1522071820081-009f0129c71c" + U, alt: "Startup team working around a laptop" , points: ["MVP development", "Scalable architecture", "Rapid iteration", "Investor-ready product"] , solutionTag: "STARTUPS", longDesc: "Get to market fast with an MVP built on architecture that can scale when the traction arrives." },
  { key: "enterprises", tag: "SCALE", title: "Enterprises", desc: "Custom internal systems and workflow automation.", img: "https://images.unsplash.com/photo-1497366754035-f200968a6e72" + U, alt: "Open-plan corporate office" , points: ["Custom internal systems", "Workflow automation", "System integrations", "Role-based access"] , solutionTag: "ENTERPRISES", longDesc: "Replace spreadsheets and disconnected tools with custom internal systems and automation that fit your processes." },
];

export const FALLBACK_PROJECTS: FallbackCard[] = [
  { key: "pos", tag: "POS System", title: "Restaurant POS Platform", desc: "Orders, kitchen, inventory and reporting in one connected system.", img: "https://images.unsplash.com/photo-1777680174389-e98bc55d8265" + U, alt: "Waiter taking an order on a handheld device" , points: ["React", "Node.js", "PostgreSQL"], result: "Sample layout" },
  { key: "portal", tag: "Web Platform", title: "Real Estate Portal", desc: "Listings, lead capture and an admin dashboard for agents.", img: "https://images.unsplash.com/photo-1748063578185-3d68121b11ff" + U, alt: "Modern house exterior lit at dusk" , points: ["Next.js", "Supabase", "Maps API"], result: "Sample layout" },
  { key: "analytics", tag: "Dashboard", title: "Retail Analytics Dashboard", desc: "Real-time sales, stock and customer insight for retail teams.", img: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d" + U, alt: "Shop assistant serving a customer at the checkout" , points: ["React", "Python", "MySQL"], result: "Sample layout" },
  { key: "ai-app", tag: "Mobile App", title: "AI Assistant App", desc: "Cross-platform mobile app with an AI-powered workflow.", img: "https://images.unsplash.com/photo-1522125670776-3c7abb882bc2" + U, alt: "Person using an app on a smartphone" , points: ["Flutter", "Firebase", "AI"], result: "Sample layout" },
  { key: "automation-suite", tag: "Automation", title: "Workflow Automation Suite", desc: "Replaced repetitive manual steps with scheduled, reliable automation.", img: "https://images.unsplash.com/photo-1689942010216-dc412bb1e7a9" + U, alt: "Warehouse aisles stacked with pallets" , points: ["Node.js", "REST APIs", "Docker"], result: "Sample layout" },
  { key: "iot-dashboard", tag: "IoT System", title: "Connected Devices Dashboard", desc: "Live telemetry and control for sensors and physical devices.", img: "https://images.unsplash.com/photo-1707733260992-73ff6dbed163" + U, alt: "Phone connected to smart light bulbs" , points: ["IoT", "Python", "Cloudflare"], result: "Sample layout" },
];

export const FALLBACK_FAQS = [
  { q: "How much does custom software development cost?", a: "It depends on scope and complexity. After a short discovery call we give you a clear, itemized estimate — no vague packages." },
  { q: "How long does it take to build a website?", a: "A focused marketing website typically takes 2–4 weeks. Web applications and custom systems run longer depending on features." },
  { q: "Do you build software for businesses in Egypt?", a: "Yes. We are based in Cairo and work with businesses across Egypt and internationally." },
  { q: "Can you build a custom POS system?", a: "Absolutely. POS, inventory, kitchen displays and management dashboards are a core specialty." },
  { q: "Can you maintain an existing website or software?", a: "Yes. We can audit, fix, extend and maintain existing projects, or take over a codebase from a previous team." },
  { q: "Can you integrate APIs and payment gateways?", a: "Yes. We integrate payment gateways, third-party APIs, messaging, maps and analytics as part of most projects." },
];
