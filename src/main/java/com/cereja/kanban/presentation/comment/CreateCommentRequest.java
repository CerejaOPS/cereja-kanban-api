package com.cereja.kanban.presentation.comment.DTO;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateCommentRequest {

    @NotBlank(message = "O conteúdo do comentário não pode ser vazio.")
    @Size(max = 2000, message = "O comentário não pode ter mais de 2000 caracteres.")
    private String content;

    // Para desenvolvimento/testes rápidos ou quando mockado no frontend:
    private String authorDiscordId;
    private String authorName;
    private String authorAvatar;
}