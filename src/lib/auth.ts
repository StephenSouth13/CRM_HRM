import { supabase } from "@/integrations/supabase/client";

export type UserRole = 'admin' | 'leader' | 'member';

export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUp(email, password, metadata) {
  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
    },
  });
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Error getting user:', error);
    return null;
  }
  return data.user;
}


export async function getUserProfile(userId: string) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        console.error('Error getting user profile:', error);
        return null;
    }

    return data;
}

export async function getUserTeam(userId: string) {
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('team_id')
        .eq('id', userId)
        .single();


    if (profileError || !profile || !profile.team_id) {
        // If user is not in a team via profile, check if they are a leader
        const { data: team, error: teamError } = await supabase
            .from('teams')
            .select('*')
            .or(`leader_id.eq.${userId},leader_2_id.eq.${userId}`)
            .single();

        if (teamError) {
            console.error('Error fetching team for leader:', teamError);
            return null;
        }
        return team;
    }

    const { data: team, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', profile.team_id)
        .single();

    if (teamError) {
        console.error('Error fetching team:', teamError);
        return null;
    }

    return team;
}