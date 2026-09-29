import { calcularFechaLimite, parsearFecha } from '../../utils/fechas.util';
import { derivarEstadoPlan, hayPlanActivo } from '../../utils/planes.util';
import { CONFLICTOS } from './conflictos.data';
import { PERSONAS } from './personas.data';
import { PLANES } from './planes.data';

/**
 * Comprueba que los datos de ejemplo cumplen las mismas reglas que se
 * aplicaran en las pantallas, para que no enganen al probarlas.
 */
describe('datos de ejemplo PNIP-CI', () => {

    it('el estado de cada plan coincide con derivarEstadoPlan', () => {
        for (const plan of PLANES) {
            expect(derivarEstadoPlan(plan.actividades, plan.fechaInicio))
                .withContext(plan.id)
                .toBe(plan.estado);
        }
    });

    it('las fechas límite coinciden con calcularFechaLimite', () => {
        for (const plan of PLANES) {
            for (const actividad of plan.actividades) {
                if (plan.fechaInicio === undefined) {
                    expect(actividad.fechaLimite).withContext(actividad.id)
                        .toBeUndefined();
                    continue;
                }
                expect(calcularFechaLimite(
                    plan.fechaInicio,
                    actividad.plazoMeses,
                    actividad.plazoDias
                )).withContext(actividad.id).toBe(
                    calcularFechaLimite(actividad.fechaLimite ?? '', 0, 0)
                );
            }
        }
    });

    it('ningún conflicto tiene más de un plan vigente', () => {
        for (const conflicto of CONFLICTOS) {
            const vigentes = conflicto.planes
                .filter((p) => hayPlanActivo([p])).length;

            expect(vigentes).withContext(conflicto.id).toBeLessThanOrEqual(1);
        }
    });

    it('los responsables de las actividades existen', () => {
        const ids = PERSONAS.map((p) => p.id);

        for (const plan of PLANES) {
            for (const actividad of plan.actividades) {
                expect(ids).withContext(actividad.id)
                    .toContain(actividad.responsableId);
            }
        }
    });

    it('las fechas de ejemplo son válidas', () => {
        for (const conflicto of CONFLICTOS) {
            expect(() => parsearFecha(conflicto.fechaDeteccion)).not.toThrow();
        }
    });
});
