package com.cereja.kanban.presentation.Board.DTO;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// DTO de resposta para membros de um quadro. 
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class MemberResponse {

    private Long id;
    private String discordId;
    private String username;
    private String avatar;
    private String role;
    
}