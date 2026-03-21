import { useQuery } from '@tanstack/react-query';
import { houseApi } from '../services/api';

export function useHouseData(month?: number, year?: number) {
  return useQuery({
    queryKey: ['house', month, year],
    queryFn: () => houseApi.getAll(month, year),
  });
}
