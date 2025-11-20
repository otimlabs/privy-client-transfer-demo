# Flash Transfer Example

A React application demonstrating how to use the Otim SDK for wallet transfers with Privy authentication and automatic delegation.

## Features

- **Privy Authentication**: Secure authentication using Privy with passkey support
- **Automatic Delegation**: Automatically sets up EIP-7702 delegation after authentication
- **SIWE Integration**: Sign-In with Ethereum for secure authentication with Otim
- **Transfer Operations**: Send tokens using the Otim SDK (coming soon)

## Prerequisites

- Node.js 20+ and pnpm
- A Privy account and app ID ([Get one here](https://privy.io))

## Setup

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Configure environment variables:**

   Create a `.env` file in the project root:

   ```env
   VITE_PRIVY_APP_ID=your_privy_app_id_here
   ```

3. **Configure Privy:**

   In your Privy dashboard:
   - Enable your preferred authentication methods (email, SMS, passkeys, social logins, etc.)
   - **Configure your app domains** - Add both:
     - `http://localhost:5173` (for `npm run dev`)
     - `http://localhost:4173` (for `npm run preview`)
   - Enable embedded wallets with "Create on login" for all users

   **Important:** If you see "origins don't match" errors, make sure both `localhost:5173` and `localhost:4173` are added to your Privy app's allowed domains.

   Note: If you get "Login with passkey not allowed" error, make sure passkeys are enabled in your Privy app settings, or the app will use other available authentication methods.

## Development

Start the development server:

```bash
pnpm dev
```

The app will be available at `http://localhost:5173`

## How It Works

### Authentication Flow

1. **Privy Login**: Users authenticate with Privy using passkeys
2. **Embedded Wallet**: Privy creates an embedded wallet for the user
3. **SIWE Authentication**: The app signs a SIWE message with the embedded wallet
4. **Otim Authentication**: The signed message is sent to Otim for authentication
5. **Automatic Delegation**: After authentication, the app automatically sets up EIP-7702 delegation

### Key Components

- **`useOtimAuth` Hook**: Manages the entire authentication and delegation flow
  - Handles Privy authentication
  - Signs SIWE messages
  - Authenticates with Otim SDK
  - Automatically performs delegation

- **`MainContent` Component**: Main app UI that handles the authentication flow
- **`AuthenticationPanel` Component**: Shows authentication and delegation status
- **`WalletStatus` Component**: Displays the connected wallet information

## Architecture

```
src/
├── components/
│   ├── app-container.tsx      # App wrapper with loading states
│   ├── authentication-panel.tsx # Auth & delegation UI
│   ├── main-content.tsx       # Main app content
│   └── wallet-status.tsx      # Wallet info display
├── hooks/
│   └── use-otim-auth.ts       # Privy + Otim auth hook
├── app.tsx                    # App entry with providers
└── wagmi.ts                   # Wagmi configuration
```

## Configuration

The app uses Sepolia testnet by default. To change the network:

1. Update `CHAIN_ID` in `src/hooks/use-otim-auth.ts`
2. Update the chain in `src/wagmi.ts`
3. Update the contract address if needed

## Troubleshooting

### Authentication Issues

- **"origins don't match" error**: This happens when your app's origin doesn't match Privy's allowed domains. Fix by:
  1. Go to your Privy dashboard → App Settings → Domains
  2. Add both `http://localhost:5173` (dev server) and `http://localhost:4173` (preview server)
  3. Make sure you're using the correct port (check your terminal output)
  4. Clear browser cache and restart the dev server
- Ensure your Privy app ID is correctly set in `.env`
- Check that your domain is whitelisted in Privy dashboard
- Verify that passkeys are enabled in Privy settings

### Delegation Issues

- Make sure the embedded wallet has some ETH for gas
- Check that the contract address is correct for your network
- Verify the chain ID matches your configuration

## Next Steps

- Implement token transfer functionality
- Add transaction history
- Support multiple networks
- Add more authentication methods

## Resources

- [Otim SDK Documentation](https://docs.otim.io)
- [Privy Documentation](https://docs.privy.io)
- [EIP-7702 Specification](https://eips.ethereum.org/EIPS/eip-7702)
