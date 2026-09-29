import { IUsuario } from './usuario';

export interface IRespuestaLogin {
  token?: string;
  usuario: IUsuario | null;
  roles?: any[];
}
