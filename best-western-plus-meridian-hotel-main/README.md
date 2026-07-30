# Best Western Plus Meridian Hotel - Digital Experience

A premium, responsive digital brochure and booking platform designed for the Best Western Plus Meridian Hotel in Nairobi, Kenya.

## Features

- **Premium UI/UX:** Built with a sophisticated, magazine-style layout featuring dark mode accents (`var(--maroon-dark)`) and elegant typography (`Outfit` and `Inter`).
- **Responsive Architecture:** Fully responsive across mobile, tablet, and desktop viewports, ensuring a seamless booking experience on any device.
- **Dynamic Modular Sections:** Content is modularized (`sections/`) and dynamically loaded for rapid development and clean code separation.
- **Integrated TripAdvisor Style Gallery:** Features a masonry preview grid and an immersive, full-screen categorized modal gallery to showcase the hotel's premium amenities and newly refurbished spaces.
- **Accessible Design:** Strict adherence to color contrast and accessibility (WCAG) standards.

## Project Structure

- `/css` - Core styling, theme engine variables, and component-specific CSS.
- `/js` - Logic for section loading, modal handling, smooth scrolling, and dynamic date pickers.
- `/sections` - Modular HTML components (Hero, Booking, Rooms, Dining, Meetings, Gallery, etc.).
- `/gallery` - High-resolution, optimized photography assets for the property.
- `index.html` - The main entry point assembling the digital brochure.

## How to Run Locally

1. Clone the repository.
2. Serve the directory using a local web server (e.g., `npx http-server`, Live Server extension, or python's `http.server`).
3. Open `http://localhost:<port>` in your browser.

*Note: Because this project uses dynamic HTML loading via JavaScript (`fetch`), opening `index.html` directly via the `file://` protocol will result in CORS errors.*