# TableDiner Pilot: The Implementation Journey

Welcome to the implementation map for the TableDiner MVP. This document lays out the step-by-step journey of how we will build this platform from the ground up, moving from the foundational data layer all the way up to a complete, ordering ecosystem.

## Chapter 1: Groundwork & Data Foundations 🏗️
**The Goal:** Build the digital skeleton of the restaurant.
**What we do:** 
We start deep in the `packages/db` layer. We currently have base models in our Prisma schema, but we need to connect the dots. We will expand the schema so that a `MenuCategory` contains `MenuItem`s, and an `Order` contains `OrderItem`s. We will define the strict relationship between a `Table`, its active `Session`, and the `Payment` tied to that session. 
**The Outcome:** A robust database structure where every real-world action (sitting at a table, adding a burger to a cart) has a perfect digital representation.

## Chapter 2: The Monorepo Wiring 🔌
**The Goal:** Create the assembly line.
**What we do:** 
Right now, the repositories exist as empty directories. We will initialize the `package.json` files for our four apps (`api`, `customer-web`, `restaurant-admin`, `platform-admin`) and our shared packages. We will set up the tooling to ensure the database schema, TypeScript types, and validation rules can be effortlessly shared across the entire ecosystem.
**The Outcome:** A unified development environment where a change to the database schema instantly updates the types available to the frontend applications.

## Chapter 3: The Customer's Journey (customer-web) 📱
**The Goal:** Replace the physical menu and the waiter.
**What we do:** 
We build a mobile-first, blazing-fast web application for diners. 
- *The Scan:* The user scans a physical QR code on their table. This opens the app with the `tableId` and `restaurantId` pre-loaded.
- *The Menu:* The app fetches the restaurant's menu from the API and displays it in categorized sections.
- *The Cart & Order:* The diner selects items and places an order. In the background, the backend creates an active `Session` for the table and logs an `Order` with the status `Received`.
**The Outcome:** A frictionless ordering experience that requires no app download from the customer.

## Chapter 4: The Kitchen's Heartbeat (restaurant-admin) 👨‍🍳
**The Goal:** Replace the paper ticket rail.
**What we do:** 
We build a dashboard for the restaurant staff and kitchen. 
- *The Ticket:* The moment a customer places an order on their phone, it appears on the kitchen dashboard as a new digital ticket. 
- *The Flow:* The kitchen staff tap the ticket to move it through the `USER_FLOWS`: `Received` -> `Preparing` -> `Ready` -> `Served`. 
**The Outcome:** An organized kitchen that knows exactly what to cook and when, with real-time sync back to the customer's phone so they know their food is coming.

## Chapter 5: Closing the Loop (Payments) 💳
**The Goal:** Ensure the restaurant gets paid smoothly.
**What we do:** 
Once the diners are finished, they check their phone for the running total of their `Session`. When they hit "Pay", we will route the transaction through a payment gateway (mocked initially for the MVP). The backend validates the total, processes the payment, marks the `Payment` status as complete, and closes the `Session`.
**The Outcome:** The table is digitally cleared and ready for the next customer, with zero awkward waiting for the bill.

## Chapter 6: The Overlord's View (platform-admin) 🏢
**The Goal:** Manage the TableDiner empire.
**What we do:** 
We build a minimalistic internal tool for our team. From here, we can create a new `Tenant` (restaurant), set up their `Table`s, generate their printable QR codes, and view high-level revenue analytics. 
**The Outcome:** The administrative tools needed to actually run TableDiner as a SaaS business.


## Chapter 7: Enterprise Analytics & Reporting 📊
**The Goal:** Provide deep operational insights to Restaurant Owners and Platform Admins.
**What we do:** 
We implement the `ANALYTICS_SPEC.md` v1. We restructure the database to support denormalized cross-tenant GMV queries, track historical financial breakdowns (Taxes, Tips, Refunds), and implement a `businessDayCutoffHour` to handle midnight crossovers seamlessly. We build robust Domain Use Cases using Hexagonal Architecture to serve metrics to new Dashboards.
**The Outcome:** A true SaaS reporting engine capable of providing EOD Audits, Table Utilization metrics, and Global GMV without crushing the database.
