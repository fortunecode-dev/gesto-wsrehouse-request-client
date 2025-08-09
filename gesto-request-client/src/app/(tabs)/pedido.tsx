import React from "react";
import Basket from "@/components/Basket";

export default function PedidoScreen() {
  return <Basket title={"Pedido"} url={"request"}  help={{
    title: "¿Cómo llenar los campos?",
    image: require("../../../assets/pedido.png"),
    content: [
  {
    "subtitle": "Actualizar",
    "content": "El botón 'Actualizar' sirve para que, si en el momento de llenar las cantidades le falta algún producto, se lo comunique al responsable del almacén. Este lo agregará y, luego, al presionar 'Actualizar', el producto aparecerá en la lista."
  },
  {
    "subtitle": "Lista de productos",
    "content": "Esta es la lista de productos que están asignados a su área (con su unidad de medida y contenido neto), para que coloque en el espacio de la derecha la cantidad que desea pedir al almacén."
  },
  {
    "subtitle": "Procedimiento",
    "content": "Llene las cantidades según su necesidad. Si no desea un producto, no es necesario poner 0. Una vez que termine, toque el botón 'Confirmar Pedido'. Después de guardarlo, no podrá modificarlo sin que el almacén lo revise. El almacén revisará y corregirá, de ser necesario, las cantidades, y usted deberá revisarlas y aprobarlas nuevamente. Cuando el almacenista le confirme las cantidades, presione 'Actualizar' y confirme nuevamente el pedido para que el almacenista pueda realizar el movimiento a su área. Puede hacer pedidos en cualquier momento."
  }
]
  }}/>
}

