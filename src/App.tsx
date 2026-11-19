import { useRoute } from './lib/hooks';
import { Home } from './pages/Home';
import { Live } from './pages/Live';
import { Drivers } from './pages/Drivers';
import { DriverDetail } from './pages/DriverDetail';

export default function App() {
  const { path, query } = useRoute();
  let page;
  if (path[0] === 'live') page = <Live focus={query.get('d')} />;
  else if (path[0] === 'drivers') page = <Drivers />;
  else if (path[0] === 'driver' && path[1]) page = <DriverDetail id={path[1]} />;
  else page = <Home />;
  return <div className="app">{page}</div>;
}
