# ANODEFLEX 2 ramas · 1 inyección

Aplicación web instalable para dimensionar y regular cuatro ramas ANODEFLEX en una red de protección catódica por corriente impresa.

## Uso

1. En **Mediciones**, ingrese el voltaje, Rc1, Rc2 y las cuatro corrientes medidas con los reóstatos en 0 Ω.
2. Pulse **Calcular y fijar resistencias**. La aplicación calcula R11, R12, R21 y R22 y las conserva para las simulaciones.
3. En **Regulación**, modifique el voltaje, los reóstatos o las corrientes objetivo. Los resultados se actualizan de inmediato.
4. Pulse **Calcular ajuste de reóstatos** para obtener los valores que producen las corrientes objetivo. La aplicación avisa si el ajuste requiere una resistencia negativa o supera el máximo configurado.
5. Revise las caídas, potencias y balances en **Verificación**.

## Instalación

- **PC y Android:** abra la dirección de la aplicación en Chrome o Edge y seleccione la opción para instalarla.
- **iPhone:** abra la aplicación en Safari, toque **Compartir** y después **Añadir a pantalla de inicio**.

Después de la primera carga, los archivos esenciales quedan disponibles sin conexión. Los resultados se calculan en el dispositivo y no se envían a servicios externos.

## Casos e informes

**Exportar caso** descarga un archivo JSON con la calibración, los ajustes y los resultados. **Importar caso** recupera ese archivo y recalcula el circuito. **Imprimir informe** genera una vista limpia que puede imprimirse o guardarse como PDF.

## Modelo

La fuente alimenta el nodo 1 mediante Rc1. En el nodo 1 están en paralelo las ramas 11 y 12, además del trayecto formado por Rc2 y las ramas 21 y 22 en paralelo. El cálculo comprueba las leyes de corriente y tensión de Kirchhoff, junto con el balance entre la potencia entregada y la potencia disipada.

## Pruebas

El archivo `tests/model.test.js` comprueba la calibración nominal, la reproducción de las corrientes de campo, el balance de potencia, el ajuste asistido y el rechazo de un caso sin tensión disponible.
