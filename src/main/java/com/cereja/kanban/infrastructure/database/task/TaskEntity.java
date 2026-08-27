package com.cereja.kanban.infraestructure.database.task;

import com.cereja.kanban.domain.Board.Board;
import com.cereja.kanban.domain.Task.TaskPhase;
import com.cereja.kanban.domain.Task.TaskPriority;
import jakarta.persistence.*; // Importe tudo do JPA
import jdk.jfr.Relational;
import lombok.*;

@Entity // 1. Diz pro Spring: "Isso aqui é uma tabela no banco!"
@Table(name = "tasks") // 2. Dá o nome plural para a tabela
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TaskEntity {

    @Id // 3. Diz que esse campo é a Chave Primária (PK)
    @GeneratedValue(strategy = GenerationType.IDENTITY) // 4. Faz o ID ser Auto Increment (1, 2, 3...)
    private Long id;

    @Column(nullable = false, length = 100) // 5. Regras da coluna: não pode ser nulo, máx 100 caracteres
    private String title;

    @Column(columnDefinition = "TEXT") // Permite textos longos
    private String description;

    @Enumerated(EnumType.STRING) // Obriga o JPA a salvar a palavra "ALTA", e não o número 2.
    @Column(nullable = false)
    private TaskPriority priority;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskPhase phase;
    
}