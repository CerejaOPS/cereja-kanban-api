package com.cereja.kanban.infrastructure.database.board;

import com.cereja.kanban.infrastructure.database.task.TaskEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "boards")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor

public class BoardEntity {


    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY) // Id auto-incremento
    private Long id;

    @Column(nullable = false, length = 100) // coluna obrigatória
    private String name;

    @Column(columnDefinition = "TEXT") // coluna de descrições longas
    private String description;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false) // para garantir que não seja alterado futuramente a data de criação
    private LocalDateTime createdAt;

    @UpdateTimestamp // atualiza sempre que sofrer uma alteração
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @OneToMany(cascade = CascadeType.ALL) // relação 1 para N (um board tem muitas tasks)
    @JoinColumn(name = "board_id") // informa qual coluna na tabela tasks guarda a chave estrangeira
    private List<TaskEntity> tasks;




}
