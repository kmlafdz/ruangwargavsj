import { useState, useEffect, useCallback } from 'react';
import {
  subscribeKeluarga, addKeluarga, updateKeluarga, deleteKeluarga,
  subscribeAnggota, addAnggota, updateAnggota, deleteAnggota,
} from '../firebase/familyService';
import { Family, FamilyMember } from '../types';

export function useKeluarga() {
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeKeluarga(data => {
      setFamilies(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const saveFamily = useCallback(async (data: Partial<Family>) => {
    if (data.id && families.find(f => f.id === data.id)) {
      await updateKeluarga(data.id, data);
      return data.id;
    } else {
      return await addKeluarga(data);
    }
  }, [families]);

  const removeFamily = useCallback(async (id: string) => {
    await deleteKeluarga(id);
  }, []);

  return { families, loading, error, saveFamily, removeFamily };
}

export function useAnggota(kkId: string | undefined) {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!kkId) { setLoading(false); return; }
    setLoading(true);
    const unsub = subscribeAnggota(kkId, data => {
      setMembers(data);
      setLoading(false);
    });
    return unsub;
  }, [kkId]);

  const saveMember = useCallback(async (data: Partial<FamilyMember>) => {
    if (!kkId) return;
    if (data.id && members.find(m => m.id === data.id)) {
      await updateAnggota(kkId, data.id, data);
    } else {
      await addAnggota(kkId, data);
    }
  }, [kkId, members]);

  const removeMember = useCallback(async (memberId: string) => {
    if (!kkId) return;
    await deleteAnggota(kkId, memberId);
  }, [kkId]);

  return { members, loading, error, saveMember, removeMember };
}
