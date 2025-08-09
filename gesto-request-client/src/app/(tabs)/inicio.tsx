import React from "react";
import Basket from "@/components/Basket";

export default function InicioScreen() {
  return <Basket title={"Cantidades iniciales"} url={"initial"} help={{
    title: "¿Cómo llenar los campos?",
    image: require("../../../assets/inicio.png"),
    content: [
      {
        "subtitle": "Actualizar",
        "content": "El botón 'Actualizar' sirve para que, si en el momento en que está llenando las cantidades le falta algún producto, se lo comunique al responsable del almacén, este lo agregue, y luego, al presionar 'Actualizar', el producto aparezca en la lista."
      },
      {
        "subtitle": "Lista de productos",
        "content": "Esta es la lista de productos que están asignados a su área (con su unidad de medida y contenido neto), para que coloque en el espacio de la derecha la cantidad con la que inicia su turno."
      },
      {
        "subtitle": "Procedimiento",
        "content": "Llene las cantidades iniciales según su conteo. Si ve un producto con una cantidad incorrecta o diferente a la que usted tiene, corríjalo. Una vez que termine, toque el botón 'Guardar Inicial'. Después de guardarlo, no podrá modificarlo; si se equivocó, debe registrarlo en las observaciones. Las cantidades que sean 0 no es necesario escribirlas, puede dejarlas en blanco."
      }
    ]

  }} />
}

