import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { usePlayer } from '@/stores/usePlayer';
import { Loading } from '@/components/ui/Loading';
import { useT } from '@/hooks/useT';

/* Code-split every scene: the hub never pays for the vault. */
const IntroScene = lazy(() => import('@/scenes/intro/IntroScene'));
const AuthScene = lazy(() => import('@/scenes/auth/AuthScene'));
const HubScene = lazy(() => import('@/scenes/hub/HubScene'));
const RoomScene = lazy(() => import('@/scenes/room/RoomScene'));
const BlackjackScene = lazy(() => import('@/scenes/blackjack/BlackjackScene'));
const VaultScene = lazy(() => import('@/scenes/vault/VaultScene'));
const InventoryScene = lazy(() => import('@/scenes/vault/InventoryScene'));
const MyRoomScene = lazy(() => import('@/scenes/profile/MyRoomScene'));
const SettingsScene = lazy(() => import('@/scenes/settings/SettingsScene'));
const CoinFlipScene = lazy(() => import('@/games/coinflip/CoinFlipScene'));
const ScratchScene = lazy(() => import('@/games/scratch/ScratchScene'));
const SlotsScene = lazy(() => import('@/games/slots/SlotsScene'));
const NightScene = lazy(() => import('@/scenes/night/NightScene'));
const HighCardScene = lazy(() => import('@/games/highcard/HighCardScene'));
const BaccaratScene = lazy(() => import('@/games/baccarat/BaccaratScene'));
const AdminScene = lazy(() => import('@/scenes/admin/AdminScene'));
const PokerScene = lazy(() => import('@/scenes/poker/PokerScene'));
const SitAndGoScene = lazy(() => import('@/scenes/poker/SitAndGoScene'));
const RouletteScene = lazy(() => import('@/scenes/roulette/RouletteScene'));
const LobbyScene = lazy(() => import('@/scenes/lobby/LobbyScene'));
const VipScene = lazy(() => import('@/scenes/vip/VipScene'));
const NotFoundScene = lazy(() => import('@/scenes/hub/NotFoundScene'));

/** Keeps the invite alive across sign-in so nobody lands back in the hub (§41). */
function RequireSession({ children }: { children: ReactNode }) {
  const ready = usePlayer((s) => s.ready);
  const id = usePlayer((s) => s.profile.id);
  const location = useLocation();
  const { t } = useT();

  if (!ready) return <Loading label={t('loading.generic')} />;
  if (!id) {
    sessionStorage.setItem('royal21.next', location.pathname);
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

/** Server-flagged admins only. The scene re-checks and every power it offers is
 *  an RPC that checks a third time, in the database — this is just so the page
 *  chrome never renders for a non-admin. */
function RequireAdmin({ children }: { children: ReactNode }) {
  const isAdmin = usePlayer((s) => s.profile.isAdmin);
  if (!isAdmin) return <Navigate to="/hub" replace />;
  return <>{children}</>;
}

function BlackjackRoomRoute() {
  const { roomCode } = useParams();
  return <BlackjackScene mode="room" roomCode={roomCode} />;
}

function RouletteRoomRoute() {
  const { roomCode } = useParams();
  return <RouletteScene mode="room" roomCode={roomCode} />;
}

function CoinFlipRoomRoute() {
  const { roomCode } = useParams();
  return <CoinFlipScene mode="room" roomCode={roomCode} />;
}

function HighCardRoomRoute() {
  const { roomCode } = useParams();
  return <HighCardScene mode="room" roomCode={roomCode} />;
}

function BaccaratRoomRoute() {
  const { roomCode } = useParams();
  return <BaccaratScene mode="room" roomCode={roomCode} />;
}

export function AppRoutes() {
  const { t } = useT();
  return (
    <Suspense fallback={<Loading label={t('loading.generic')} />}>
      <Routes>
        <Route path="/" element={<IntroScene />} />
        <Route path="/login" element={<AuthScene />} />
        <Route path="/hub" element={<RequireSession><HubScene /></RequireSession>} />
        <Route path="/room/:roomCode" element={<RequireSession><RoomScene /></RequireSession>} />
        <Route path="/night/:roomCode" element={<RequireSession><NightScene /></RequireSession>} />
        <Route path="/poker/sng/:roomCode" element={<RequireSession><SitAndGoScene /></RequireSession>} />
        <Route path="/poker/:roomCode" element={<RequireSession><PokerScene /></RequireSession>} />
        <Route path="/blackjack/solo" element={<RequireSession><BlackjackScene mode="solo" /></RequireSession>} />
        <Route path="/blackjack/room/:roomCode" element={<RequireSession><BlackjackRoomRoute /></RequireSession>} />
        <Route path="/game/coinflip" element={<RequireSession><CoinFlipScene mode="solo" /></RequireSession>} />
        <Route path="/game/coinflip/room/:roomCode" element={<RequireSession><CoinFlipRoomRoute /></RequireSession>} />
        <Route path="/game/scratch" element={<RequireSession><ScratchScene /></RequireSession>} />
        <Route path="/game/slots" element={<RequireSession><SlotsScene /></RequireSession>} />
        <Route path="/game/highcard" element={<RequireSession><HighCardScene mode="solo" /></RequireSession>} />
        <Route path="/game/highcard/room/:roomCode" element={<RequireSession><HighCardRoomRoute /></RequireSession>} />
        <Route path="/game/baccarat" element={<RequireSession><BaccaratScene mode="solo" /></RequireSession>} />
        <Route path="/game/baccarat/room/:roomCode" element={<RequireSession><BaccaratRoomRoute /></RequireSession>} />
        <Route path="/game/roulette/solo" element={<RequireSession><RouletteScene mode="solo" /></RequireSession>} />
        <Route path="/game/roulette/room/:roomCode" element={<RequireSession><RouletteRoomRoute /></RequireSession>} />
        <Route path="/lobby" element={<RequireSession><LobbyScene /></RequireSession>} />
        <Route path="/vip" element={<RequireSession><VipScene /></RequireSession>} />
        <Route path="/vault" element={<RequireSession><VaultScene /></RequireSession>} />
        <Route path="/inventory" element={<RequireSession><InventoryScene /></RequireSession>} />
        <Route path="/profile/:userId" element={<RequireSession><MyRoomScene /></RequireSession>} />
        <Route path="/settings" element={<RequireSession><SettingsScene /></RequireSession>} />
        <Route path="/admin" element={<RequireSession><RequireAdmin><AdminScene /></RequireAdmin></RequireSession>} />
        <Route path="*" element={<NotFoundScene />} />
      </Routes>
    </Suspense>
  );
}
