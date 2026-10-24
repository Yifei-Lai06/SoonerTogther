-- SoonerTogether — reference data and starter Study Circles.
-- Courses mirror src/lib/data/catalog.ts. Circles have no members yet: real
-- students fill them. Safe to re-run.

insert into public.courses (id, title, dept, topics) values
  ('MATH 1914', 'Differential & Integral Calculus I', 'Mathematics',
    array['Limits','Continuity','Derivative rules','Chain Rule','Implicit differentiation','Related rates','Linear approximation','Optimization','Integrals']),
  ('MATH 2924', 'Differential & Integral Calculus II', 'Mathematics',
    array['Integration by parts','Trig substitution','Series','Convergence tests','Parametric curves']),
  ('CS 1323', 'Introduction to Computer Programming', 'Computer Science',
    array['Java basics','Arrays','For-loops','Methods','Objects','Debugging']),
  ('CS 2413', 'Data Structures', 'Computer Science',
    array['Linked lists','Stacks & queues','Trees','Big-O','Hash tables','Recursion']),
  ('CHEM 1315', 'General Chemistry', 'Chemistry',
    array['Stoichiometry','Gas laws','Thermochemistry','Electron configuration','Bonding']),
  ('PHYS 2514', 'General Physics for Engineering & Science Majors I', 'Physics',
    array['Kinematics','Newton''s laws','Work & energy','Momentum','Rotational motion']),
  ('ENGL 1113', 'Principles of English Composition I', 'English',
    array['Thesis statements','Essay structure','Citations','Revision','Argument']),
  ('ECON 1123', 'Principles of Economics: Micro', 'Economics',
    array['Supply & demand','Elasticity','Market structures','Consumer choice','Graph reading'])
on conflict (id) do update set title = excluded.title, dept = excluded.dept, topics = excluded.topics;

do $$
declare v_id uuid; r record;
begin
  for r in select * from (values
    ('Calculus Survival Circle', 'MATH 1914', array['Chain Rule','Related rates'],
      'Each member brings one related-rates problem and explains their setup.', 'wed', 'afternoon', '4:00 PM',
      'in-person', 'Bizzell Memorial Library (suggested)', 5,
      array['Draw a labeled diagram before writing any equation', 'Explain the Chain Rule to someone in under 60 seconds', 'Solve one problem where a ladder slides down a wall']),
    ('Java Jam', 'CS 1323', array['Arrays','For-loops','Methods'],
      'Trace one loop by hand, then write it together.', 'thu', 'evening', '6:30 PM',
      'either', 'Online or a campus study room (members decide)', 6,
      array['Write a loop that sums an array without looking anything up', 'Find the off-by-one bug in a partner''s code']),
    ('Chem Study Hall', 'CHEM 1315', array['Stoichiometry','Gas laws'],
      'Work three stoichiometry problems as a group, rotating who leads.', 'mon', 'evening', '7:00 PM',
      'in-person', 'Bizzell Memorial Library (suggested)', 5,
      array['Balance five equations in ten minutes']),
    ('Essay Accountability Crew', 'ENGL 1113', array['Thesis statements','Revision'],
      'Share one paragraph and give one kind, specific suggestion.', 'sun', 'evening', '7:00 PM',
      'online', 'Online', 6,
      array['Write your thesis in one sentence'])
  ) as t(name, course, focus, objective, day, part, time_label, format, location, capacity, challenges)
  loop
    if not exists (select 1 from public.circles where name = r.name and creator_id is null) then
      insert into public.circles (name, course_id, focus, weekly_objective, day, part, time_label, format, location, capacity)
      values (r.name, r.course, r.focus, r.objective, r.day, r.part, r.time_label, r.format, r.location, r.capacity)
      returning id into v_id;
      insert into public.circle_challenges (circle_id, text, position)
      select v_id, c, ord - 1 from unnest(r.challenges) with ordinality as u(c, ord);
      insert into public.conversations (kind, circle_id) values ('circle', v_id);
    end if;
  end loop;
end $$;
