import { useRoute } from './lib/hooks';
import { Home } from './pages/Home';
import { Live } from './pages/Live';
import { Drivers } from './pages/Drivers';
import { DriverDetail } from './pages/DriverDetail';
import { Standings } from './pages/Standings';
import { ReplayPage } from './pages/Replay';

export default function App() {
  const { page, id } = useRoute();
  let view;
  if (page === 'live') view = <Live focus={id} />;
  else if (page === 'drivers') view = <Drivers />;
  else if (page === 'standings') view = <Standings />;
  else if (page === 'replay') view = <ReplayPage />;
  else if (page === 'driver' && id) view = <DriverDetail id={id} />;
  else view = <Home />;
  return <div className="app">{view}</div>;
}
