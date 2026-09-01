# PersonaVault

PersonaVault is a modern, encrypted digital vault built with React and Supabase for storing sensitive information securely. It features end-to-end encryption, biometric authentication, and a secure file storage system.

## Features

- **Secure Vault**: Encrypted storage for passwords, notes, cards, and files.
- **End-to-End Encryption**: All sensitive data is encrypted locally using a session key derived from your master password.
- **Biometric Authentication**: Built-in support for Face ID and Touch ID (WebAuthn).
- **Smart OCR**: Automatically extracts card details (PAN, Expiry, CVV) from uploaded images.
- **Real-time Sync**: Changes are synced instantly across devices via Supabase.
- **Offline Support**: Progressive Web App (PWA) allows access to offline data when re-connected.
- **Secure File Storage**: Upload and store encrypted files securely.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/)
- A free Supabase account for the backend.

### Installation

1.  **Clone the repository**
    ```bash
    git clone <repository-url>
    cd project
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

### Configuration

1.  **Create a `.env.local` file** in the root directory:
    ```bash
    cp .env.example .env.local
    ```

2.  **Update `.env.local`** with your Supabase credentials:
    ```env
    VITE_SUPABASE_URL=your-supabase-url
    VITE_SUPABASE_ANON_KEY=your-anon-key
    ```

### Running the App

1.  **Start the development server**
    ```bash
    npm run dev
    ```

2.  **Open the app**
    Navigate to `http://localhost:5173` in your browser.

## Project Structure

- `src/lib/`: Contains core logic like Supabase client, encryption helpers, and utilities.
- `src/components/`: React components organized by feature (`Auth`, `Dashboard`, `Notes`, `Cards`).
- `src/pages/`: Top-level page components.
- `src/assets/`: Static assets and icons.
- `src/styles/`: Global styles and Tailwind configurations.

## Security Notes

- **Never commit `node_modules` or `.env.local` to version control.**
- The app uses `crypto.subtle` for cryptographic operations.
- All user data is encrypted at rest and in transit.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
