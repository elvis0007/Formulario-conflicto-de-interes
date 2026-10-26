import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BackendService } from '../backend.service';
import { PersonasHttpService } from './personas-http.service';

describe('PersonasHttpService', () => {
  it('buscarPersonas usa el código de nómina como id y descarta los que no lo tienen', (done) => {
    const backend = jasmine.createSpyObj<BackendService>('BackendService', ['buscarPersonal']);
    backend.buscarPersonal.and.returnValue(of([
      { CODIGO: 'DMPER1', CEDULA: '1700000001', NOMBRE_COMPLETO: 'PEREZ JUAN' },
      { CODIGO: null, CEDULA: '1700000002', NOMBRE_COMPLETO: 'SIN CODIGO' }
    ]));
    TestBed.configureTestingModule({ providers: [{ provide: BackendService, useValue: backend }] });

    TestBed.inject(PersonasHttpService).buscarPersonas('perez').subscribe((lista) => {
      expect(backend.buscarPersonal).toHaveBeenCalledWith('perez');
      expect(lista).toEqual([
        { id: 'DMPER1', nombres: 'PEREZ JUAN', cedula: '1700000001', cargo: '', departamento: '' }
      ]);
      done();
    });
  });
});
