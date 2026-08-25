import { useEffect } from 'react';
import { useStore, bootstrapTimers, Screen } from './store';
import { Splash, Auth, Welcome } from './screens/Intro';
import Home from './screens/Home';
import Garage from './screens/Garage';
import VehicleDetails from './screens/VehicleDetails';
import { Trips, TripDetail } from './screens/Trips';
import { Service, Documents } from './screens/Service';
import Expenses from './screens/Expenses';
import Fuel from './screens/Fuel';
import Notifications from './screens/Notifications';
import Profile from './screens/Profile';
import { Units, Privacy, Account } from './screens/Settings';
import Wrap from './screens/Wrap';
import { Friends, FriendProfile } from './screens/Friends';
import AddVehicle from './screens/AddVehicle';
import BottomNav from './components/BottomNav';
import { Toast } from './components/UI';
import { ConfirmSheet, ExpenseSheet, ServiceSheet, FrameSheet, RefuelSheet } from './components/Sheets';

const SCREENS: Record<Screen, React.ComponentType> = {
  home: Home, garage: Garage, details: VehicleDetails, trips: Trips, trip: TripDetail,
  service: Service, documents: Documents, expenses: Expenses, fuel: Fuel,
  notifications: Notifications, profile: Profile, wrap: Wrap, friends: Friends, friend: FriendProfile,
  addVehicle: AddVehicle, units: Units, privacy: Privacy, account: Account,
};

function AppShell() {
  const screen = useStore((s) => s.screen);
  const hasVehicle = useStore((s) => s.vehicles.length > 0);

  if (!hasVehicle) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflow: 'auto', padding: 'calc(env(safe-area-inset-top) + 22px) 0 40px' }}>
          <AddVehicle onboarding />
        </div>
        <Toast />
      </div>
    );
  }

  const ScreenComp = SCREENS[screen] || Home;
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: 'calc(env(safe-area-inset-top) + 22px) 0 calc(env(safe-area-inset-bottom) + 108px)' }}>
        <ScreenComp />
      </div>
      <BottomNav />
      <Toast />
      <ExpenseSheet />
      <FrameSheet />
      <ConfirmSheet />
      <ServiceSheet />
      <RefuelSheet />
    </div>
  );
}

export default function App() {
  const phase = useStore((s) => s.phase);
  const lang = useStore((s) => s.lang);
  const he = lang === 'he';

  useEffect(() => { bootstrapTimers(); }, []);

  return (
    <div dir={he ? 'rtl' : 'ltr'} style={{
      position: 'fixed', inset: 0, background: '#08090B', color: '#F1F0EE', overflow: 'hidden',
      fontFamily: he ? 'Assistant, Jost, sans-serif' : 'Jost, Assistant, sans-serif',
    }}>
      {phase === 'splash' && <Splash />}
      {phase === 'auth' && <Auth />}
      {phase === 'welcome' && <Welcome />}
      {phase === 'app' && <AppShell />}
    </div>
  );
}
