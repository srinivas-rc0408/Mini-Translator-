import { supabase, isSupabaseAvailable } from '../lib/supabase';
import { TranslationEntry } from '../types';

export class DbService {
  private static getLocalKey(userId: string): string {
    return `minitranslator_local_db_${userId}`;
  }

  private static getLocalData(userId: string): TranslationEntry[] {
    try {
      const data = localStorage.getItem(this.getLocalKey(userId));
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private static saveLocalData(userId: string, data: TranslationEntry[]): void {
    try {
      localStorage.setItem(this.getLocalKey(userId), JSON.stringify(data));
    } catch (e) {
      console.error("Local storage quota exceeded or failed", e);
    }
  }

  static async saveTranslation(userId: string, entry: Omit<TranslationEntry, 'id'>): Promise<TranslationEntry> {
    if (userId.startsWith('local-') || !isSupabaseAvailable()) {
      const localEntry: TranslationEntry = {
        ...entry,
        id: 'local_entry_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      };
      const list = this.getLocalData(userId);
      list.unshift(localEntry);
      this.saveLocalData(userId, list);
      return localEntry;
    }

    try {
      const { data, error } = await supabase
        .from('translations')
        .insert({
          user_id: userId,
          mode: entry.mode,
          source_lang: entry.sourceLang,
          target_lang: entry.targetLang,
          input_text: entry.inputText,
          output: entry.output,
          is_saved: entry.isSaved,
          image_url: entry.image,
          translated_image: entry.translatedImage,
          segments: entry.segments,
          created_at: new Date(entry.timestamp).toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      return this.mapToEntry(data);
    } catch (err) {
      console.warn("Supabase save failed, performing local storage save:", err);
      // Fallback save locally
      const localEntry: TranslationEntry = {
        ...entry,
        id: 'local_entry_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      };
      const list = this.getLocalData(userId);
      list.unshift(localEntry);
      this.saveLocalData(userId, list);
      return localEntry;
    }
  }

  static async getHistory(userId: string): Promise<TranslationEntry[]> {
    if (userId.startsWith('local-') || !isSupabaseAvailable()) {
      return this.getLocalData(userId).filter(item => !item.isSaved);
    }

    try {
      const { data, error } = await supabase
        .from('translations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return (data || []).map(this.mapToEntry);
    } catch (err) {
      console.warn("Supabase getHistory failed, fetching local history:", err);
      return this.getLocalData(userId).filter(item => !item.isSaved);
    }
  }

  static async getSaved(userId: string): Promise<TranslationEntry[]> {
    if (userId.startsWith('local-') || !isSupabaseAvailable()) {
      return this.getLocalData(userId).filter(item => item.isSaved);
    }

    try {
      const { data, error } = await supabase
        .from('translations')
        .select('*')
        .eq('user_id', userId)
        .eq('is_saved', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(this.mapToEntry);
    } catch (err) {
      console.warn("Supabase getSaved failed, fetching local saved:", err);
      return this.getLocalData(userId).filter(item => item.isSaved);
    }
  }

  static async toggleSave(id: string, isSaved: boolean): Promise<void> {
    if (id.startsWith('local_entry_') || id.includes('local') || !isSupabaseAvailable()) {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('minitranslator_local_db_')) {
          try {
            const list = JSON.parse(localStorage.getItem(key) || '[]');
            const index = list.findIndex((item: any) => item.id === id);
            if (index !== -1) {
              list[index].isSaved = isSaved;
              localStorage.setItem(key, JSON.stringify(list));
              return;
            }
          } catch (e) {
            console.error("Failed to parse local list", e);
          }
        }
      }
      return;
    }

    try {
      const { error } = await supabase
        .from('translations')
        .update({ is_saved: isSaved })
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      console.warn("Supabase toggleSave failed, fall back to search local storage:", err);
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('minitranslator_local_db_')) {
          try {
            const list = JSON.parse(localStorage.getItem(key) || '[]');
            const index = list.findIndex((item: any) => item.id === id);
            if (index !== -1) {
              list[index].isSaved = isSaved;
              localStorage.setItem(key, JSON.stringify(list));
              return;
            }
          } catch (e) {}
        }
      }
    }
  }

  static async deleteEntry(id: string): Promise<void> {
    if (id.startsWith('local_entry_') || id.includes('local') || !isSupabaseAvailable()) {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('minitranslator_local_db_')) {
          try {
            const list = JSON.parse(localStorage.getItem(key) || '[]');
            const filtered = list.filter((item: any) => item.id !== id);
            if (filtered.length !== list.length) {
              localStorage.setItem(key, JSON.stringify(filtered));
              return;
            }
          } catch (e) {}
        }
      }
      return;
    }

    try {
      const { error } = await supabase
        .from('translations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      console.warn("Supabase deleteEntry failed, fallback to local:", err);
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('minitranslator_local_db_')) {
          try {
            const list = JSON.parse(localStorage.getItem(key) || '[]');
            const filtered = list.filter((item: any) => item.id !== id);
            if (filtered.length !== list.length) {
              localStorage.setItem(key, JSON.stringify(filtered));
              return;
            }
          } catch (e) {}
        }
      }
    }
  }

  static async clearHistory(userId: string): Promise<void> {
    if (userId.startsWith('local-') || !isSupabaseAvailable()) {
      const list = this.getLocalData(userId).filter(item => item.isSaved);
      this.saveLocalData(userId, list);
      return;
    }

    try {
      const { error } = await supabase
        .from('translations')
        .delete()
        .eq('user_id', userId)
        .eq('is_saved', false);

      if (error) throw error;
    } catch (err) {
      console.warn("Supabase clearHistory failed, fall back to local:", err);
      const list = this.getLocalData(userId).filter(item => item.isSaved);
      this.saveLocalData(userId, list);
    }
  }

  private static mapToEntry(data: any): TranslationEntry {
    return {
      id: data.id,
      timestamp: new Date(data.created_at).getTime(),
      mode: data.mode,
      sourceLang: data.source_lang,
      targetLang: data.target_lang,
      inputText: data.input_text || '',
      output: data.output,
      isSaved: data.is_saved,
      image: data.image_url,
      translatedImage: data.translated_image,
      segments: data.segments
    };
  }
}
