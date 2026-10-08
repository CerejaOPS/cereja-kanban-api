package com.cereja.kanban.presentation.Board.DTO;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor

public class CreateBoardRequest {

    @NotBlank(message = "nome do Board é obrigatório")//torna o nome obrigatório
    @Size(max = 100, message = "o nome não pode ter mais de 100 caracteres")//limita o tamanho do nome
    private String name;

    private String description;

}
