import { Topbar } from '../components/Topbar';
import { CarPhoto, PhotoCredit, carPhoto } from '../components/CarPhoto';
import { Flag } from '../components/Avatar';
import { TEAMS } from '../data/teams';
import { DRIVERS } from '../data/drivers';
import { teamIdFor, useStandings } from '../data/openf1';

export function Teams() {
  const { data } = useStandings();
  const ordered = Object.values(TEAMS).sort((a, b) => {
    const pa = data?.teams.find((t) => teamIdFor(t.team_name) === a.id)?.position_current ?? 99;
    const pb = data?.teams.find((t) => teamIdFor(t.team_name) === b.id)?.position_current ?? 99;
    return pa - pb;
  });
  return (
    <>
      <Topbar title="Teams & cars" back="home" current="teams" />
      <div className="drivers-head">
        <div className="eyebrow">2026 grid · 11 teams</div>
        <h1>The Cars</h1>
      </div>
      <div className="team-grid">
        {ordered.map((t) => {
          const champ = data?.teams.find((x) => teamIdFor(x.team_name) === t.id);
          const p = carPhoto(t.id);
          return (
            <article key={t.id} className="tcard" style={{ ['--team' as string]: t.color }}>
              <div className="tcard__photo">
                <CarPhoto teamId={t.id} sizes="(min-width: 900px) 600px, 100vw" />
              </div>
              <div className="tcard__body">
                <div className="tcard__head">
                  <div>
                    <div className="eyebrow">{p?.car ?? '2026 car'}</div>
                    <h2>{t.name}</h2>
                  </div>
                  {champ && (
                    <div className="tcard__champ tnum">
                      <b>P{champ.position_current}</b>
                      <span>{champ.points_current} pts</span>
                    </div>
                  )}
                </div>
                <div className="tcard__drivers">
                  {DRIVERS.filter((d) => d.teamId === t.id).map((d) => (
                    <a key={d.id} href={`#driver-${d.id}`} className="chip">
                      <Flag country={d.country} size={13} />
                      <b style={{ color: t.color }}>{d.number}</b> {d.firstName} {d.lastName}
                    </a>
                  ))}
                </div>
                <div className="tcard__meta">
                  <span>{t.powerUnit} power unit</span>
                  <span>{t.base}</span>
                </div>
                <PhotoCredit teamId={t.id} />
              </div>
            </article>
          );
        })}
      </div>
      <p className="note">
        Car photos are freely licensed images from Wikimedia Commons, credited under each photo. Teams without a free photo of their 2026 car show
        an illustration in team colours instead.
      </p>
    </>
  );
}
