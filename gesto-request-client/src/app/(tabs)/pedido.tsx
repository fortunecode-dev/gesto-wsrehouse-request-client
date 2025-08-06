import React from "react";
import Basket from "@/components/Basket";

export default function PedidoScreen() {
  return <Basket title={"Pedido"} url={"request"}  help={{
    title: "¿Cómo llenar los campos?",
    image: require("../../../assets/ayudaInicial.png"),
    content: [
      {
        subtitle: "Cantidad",
        content: "Indique la cantidad exacta de unidades disponibles del producto."
      },
      {
        subtitle: "Stock",
        content: "El sistema validará que la cantidad no supere el stock permitido."
      }
    ]
  }}/>
}

