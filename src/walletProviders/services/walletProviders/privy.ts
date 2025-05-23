import {
  useLogin,
  usePrivy,
  useEmbeddedSolanaWallet,
  useRecoverEmbeddedWallet,
  isNotCreated,
  needsRecovery,
} from '@privy-io/expo';
import {useCallback} from 'react';

export function usePrivyWalletLogic() {
  const {login} = useLogin();
  const {user, isReady, logout, error} = usePrivy();
  const solanaWallet = useEmbeddedSolanaWallet();
  const {recover} = useRecoverEmbeddedWallet();

  const handlePrivyLogin = useCallback(
    async ({
      loginMethod = 'email',
      setStatusMessage,
    }: {
      loginMethod?: 'email' | 'sms' | 'apple' | 'google';
      setStatusMessage?: (msg: string) => void;
    }) => {
      console.log('[PrivyDebug] Entering handlePrivyLogin. Method:', loginMethod, 'IsReady:', isReady);

      if (user) {
        console.log('[PrivyDebug] User already exists, skipping login.');
        setStatusMessage?.(`You are already logged in as ${user?.id}`);
        return;
      }
      try {
        console.log('[PrivyDebug] Attempting to set status message before login call.');
        setStatusMessage?.(`Connecting with privy via ${loginMethod}...`);
        // The actual login call
        console.log('[PrivyDebug] About to call Privy login function.');
        const session = await login({
          loginMethods: [loginMethod],
          appearance: {logo: ''},
        });

        console.log('Privy session after login attempt:', JSON.stringify(session, null, 2));

        if (session?.user) {
          setStatusMessage?.(`Connected user: ${session.user.id}`);
          console.log('Privy login successful, user ID:', session.user.id);
        } else {
          setStatusMessage?.('Login attempt completed, but no user session was established.');
          console.warn('Privy login attempt did not result in a user session. Session object:', JSON.stringify(session, null, 2));
        }
      } catch (error: any) {
        console.error('[PrivyDebug] Privy Login Error in catch block:', error);
        // Log additional details if available
        if (error.code || error.type || error.message) {
            console.error('[PrivyDebug] Privy Login Error details:', { 
                code: error.code, 
                type: error.type, 
                message: error.message,
                stack: error.stack // Adding stack trace if available
            });
        }
        setStatusMessage?.(`Connection failed: ${error.message || 'Unknown error during login'}`);
      }
    },
    [user, login, isReady],
  );

  const monitorSolanaWallet = useCallback(
    async ({
      selectedProvider,
      setStatusMessage,
      onWalletConnected,
    }: {
      selectedProvider: string;
      setStatusMessage?: (msg: string) => void;
      onWalletConnected?: (info: {provider: 'privy'; address: string}) => void;
    }) => {
      if (selectedProvider !== 'privy' || !user || !isReady || !solanaWallet) {
        return;
      }

      try {
        if (solanaWallet.getProvider) {
          const provider = await solanaWallet.getProvider().catch(() => null);
          if (provider && solanaWallet.wallets) {
            const connectedWallet = solanaWallet.wallets[0];
            setStatusMessage?.(
              `Connected to existing wallet: ${connectedWallet.publicKey}`,
            );
            onWalletConnected?.({
              provider: 'privy',
              address: connectedWallet.publicKey,
            });
            return;
          }
        } else {
          console.warn('solanaWallet.getProvider is undefined');
        }
      } catch (error) {
        console.warn('getProvider failed:', error);
      }

      if (needsRecovery(solanaWallet)) {
        setStatusMessage?.('Wallet needs recovery');
        return;
      }

      if (isNotCreated(solanaWallet)) {
        await solanaWallet.create();
        const newWallet = solanaWallet.wallets[0];
        setStatusMessage?.(`Created wallet: ${newWallet.publicKey}`);
        onWalletConnected?.({
          provider: 'privy',
          address: newWallet.publicKey,
        });
      }
    },
    [isReady, solanaWallet, user],
  );

  const handleWalletRecovery = useCallback(
    async ({
      recoveryMethod,
      password,
      setStatusMessage,
      onWalletRecovered,
    }: {
      recoveryMethod: 'user-passcode' | 'google-drive' | 'icloud';
      password: string;
      setStatusMessage?: (msg: string) => void;
      onWalletRecovered?: (info: {provider: 'privy'; address: string}) => void;
    }) => {
      try {
        setStatusMessage?.('Recovering wallet...');
        await recover({recoveryMethod, password});
        const provider = solanaWallet.getProvider
          ? await solanaWallet.getProvider().catch(() => null)
          : null;
        if (
          provider &&
          solanaWallet.wallets &&
          solanaWallet.wallets.length > 0
        ) {
          const recoveredWallet = solanaWallet.wallets[0];
          setStatusMessage?.(`Recovered wallet: ${recoveredWallet.publicKey}`);
          onWalletRecovered?.({
            provider: 'privy',
            address: recoveredWallet.publicKey,
          });
        } else {
          setStatusMessage?.('Wallet recovery failed: Provider not available');
        }
      } catch (error: any) {
        console.error('Wallet recovery error:', error);
        setStatusMessage?.(`Wallet recovery failed: ${error.message}`);
      }
    },
    [recover, solanaWallet],
  );

  const handlePrivyLogout = useCallback(
    async (setStatusMessage?: (msg: string) => void) => {
      try {
        await logout();
        setStatusMessage?.('Logged out successfully');
      } catch (error: any) {
        setStatusMessage?.(error.message || 'Logout failed');
      }
    },
    [logout],
  );

  return {
    user,
    isReady,
    solanaWallet,
    handlePrivyLogin,
    handlePrivyLogout,
    monitorSolanaWallet,
    handleWalletRecovery,
  };
}

export default usePrivyWalletLogic;
