import PHOTOS from '../data/car-photos.json';
import { TEAMS } from '../data/teams';
import { CarArt } from './CarArt';

export interface CarPhotoInfo {
  team: string;
  car: string;
  small: string;
  large: string;
  width: number;
  height: number;
  /** Horizontal focus point (0–1) so the car stays in frame when cropped. */
  focusX: number;
  artist: string;
  license: string;
  licenseUrl: string;
  page: string;
}

const LIST = PHOTOS as CarPhotoInfo[];
export const carPhoto = (teamId: string) => LIST.find((p) => p.team === teamId) ?? null;

const url = (file: string) => `${import.meta.env.BASE_URL}cars/${file}`;

/** Credit line required by the photo's free licence. */
export function PhotoCredit({ teamId, className = 'photo-credit' }: { teamId: string; className?: string }) {
  const p = carPhoto(teamId);
  if (!p) return null;
  return (
    <span className={className}>
      Photo: {p.artist || 'Wikimedia Commons contributor'} ·{' '}
      <a href={p.licenseUrl || p.page} target="_blank" rel="noreferrer">
        {p.license}
      </a>{' '}
      ·{' '}
      <a href={p.page} target="_blank" rel="noreferrer">
        source
      </a>
    </span>
  );
}

/**
 * The team's real 2026 car (freely licensed photo from Wikimedia Commons),
 * or the original illustration in team colours when no free photo is available.
 */
export function CarPhoto({
  teamId,
  className = '',
  sizes = '100vw',
  eager = false,
}: {
  teamId: string;
  className?: string;
  sizes?: string;
  eager?: boolean;
}) {
  const p = carPhoto(teamId);
  if (!p) return <CarArt color={TEAMS[teamId]?.color ?? '#e10600'} />;
  return (
    <img
      className={`carphoto ${className}`}
      src={url(p.small)}
      srcSet={`${url(p.small)} 1280w, ${url(p.large)} 2560w`}
      sizes={sizes}
      width={p.width}
      height={p.height}
      alt={`${TEAMS[teamId]?.name ?? ''} ${p.car}`}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      style={{ objectPosition: `${Math.round(p.focusX * 100)}% 50%` }}
    />
  );
}
