import React from "react";
import Basket from "@/components/Basket";

export default function FinalScreen() {
  return <Basket title={"Cantidades finales"} url={"final"} help={{
    title: "¿Cómo llenar los campos?",
    image: require("../../../assets/final.png"),
    content: [
      {
        "subtitle": "Actualizar",
        "content": "El botón 'Actualizar' sirve para que, una vez completadas las cantidades finales, se actualice la cantidad consumida (cantidad consumida = cantidad inicial + entrada - cantidad final). Si, en el momento de llenar las cantidades, le falta algún producto, comuníqueselo al responsable del almacén para que lo agregue, y luego, al presionar 'Actualizar', el producto aparecerá en la lista."
      },
      {
        "subtitle": "Lista de productos",
        "content": "Esta es la lista de productos que están asignados a su área (con su unidad de medida y contenido neto), para que coloque en el espacio de la derecha la cantidad con la que finalizó su turno."
      },
      {
        "subtitle": "Procedimiento",
        "content": "Llene las cantidades finales según su conteo. Si ve un producto con una cantidad incorrecta o diferente a la que usted tiene, corríjalo. Una vez que termine, toque el botón 'Guardar Final'. Después de guardarlo, no podrá modificarlo; si se equivocó, debe registrarlo en las observaciones. Las cantidades que sean 0 no es necesario escribirlas, puede dejarlas en blanco. Al guardar las cantidades finales, automáticamente volverá a la pantalla de selección de local. Si tiene alguna observación, vuelva a seleccionar el local y su nombre."
      }
    ]
  }} />
}

