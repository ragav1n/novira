-- Create a table for public profiles
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  updated_at timestamptz,
  full_name text,
  avatar_url text,
  monthly_budget numeric default 3000,
  currency text default 'USD'
);

-- Access policies for profiles
alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);

-- Create a table for transactions
create table transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  description text not null,
  amount numeric not null,
  category text not null,
  payment_method text not null default 'Cash',
  notes text,
  date date not null default CURRENT_DATE,
  created_at timestamptz default now()
);

-- Set up Row Level Security (RLS)
alter table transactions enable row level security;

create policy "Users can view their own transactions"
on transactions for select
using ( auth.uid() = user_id );

create policy "Users can insert their own transactions"
on transactions for insert
with check ( auth.uid() = user_id );

create policy "Users can update their own transactions"
on transactions for update
using ( auth.uid() = user_id );

create policy "Users can delete their own transactions"
on transactions for delete
using ( auth.uid() = user_id );

-- Function to handle new user signup
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to automatically create profile on signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
