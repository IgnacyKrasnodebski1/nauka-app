-- Recall 2.0 — pola pod nowe ekrany (design/DESIGN.md §4): cel nauki, motywy, boost, album pojęć, poprawki pytań,
-- plany do sprawdzianów, misja tygodniowa, dziennik dnia (podsumowanie tygodnia), plan dnia, ustawienia ruchu/przypomnień,
-- boss rozdziału i duch (najlepszy przebieg poziomu) w postępach.
-- Decyzja: plany do sprawdzianów (`tests`) siedzą jako JSONB w user_meta (jeden plan na przedmiot, liczony po stronie
-- klienta jak w legacy), a nie w osobnej tabeli — nie ma zapytań po nich poza „moje plany”, RLS user_meta już je chroni.

alter table public.profiles
  add column if not exists goal text; -- 'sprawdziany' | 'matura-p' | 'matura-r' | 'olimpiada' | 'sesja' | 'wlasny'

alter table public.user_meta
  add column if not exists themes jsonb not null default '{"owned":["violet"],"active":"violet"}'::jsonb,
  add column if not exists boost_until timestamptz,
  add column if not exists album jsonb not null default '{}'::jsonb,        -- "<topicId>:<levelId>:<cardIdx>" → {rarity, at}
  add column if not exists overrides jsonb not null default '{}'::jsonb,    -- "<topicId>:<levelId>:<qi>" → {q,a,c,e,at}; "hide:<topicId>:<levelId>" → true
  add column if not exists tests jsonb not null default '[]'::jsonb,        -- [{id, subjectId, levels:["<topicId>:<levelId>"], date, plan:[…], built}]
  add column if not exists weekly_quest jsonb,                              -- Quest z id "w:<poniedziałek>:<kind>"
  add column if not exists history jsonb not null default '{}'::jsonb,      -- "yyyy-mm-dd" → {levels, reviews, cards, combo, missions}
  add column if not exists daily jsonb,                                     -- {date, tasks:[{id, done, need?, prog?}], planDone?}
  add column if not exists reduce_motion boolean not null default false,
  add column if not exists reminder jsonb,                                  -- {on, at:"19:30"}
  add column if not exists exams jsonb not null default '{}'::jsonb;        -- "<topicId>" → {n, passed, best?:{pct,grade,correct,total,date}, last?}

alter table public.progress
  add column if not exists boss jsonb,                                      -- {done, n, at?, best?}
  add column if not exists ghost jsonb not null default '{}'::jsonb;        -- "<levelId>" → {run:[{t,correct}], at}
