package com.cereja.kanban.infrastructure.database.discordUser;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "discord_users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class DiscordUserEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY) // Faz o ID ser Auto Increment (1, 2, 3...)
    private Long id;

    @Column(nullable = false, length = 50, unique = true)
    private String discordId;

    @Column(nullable = false, length = 150)
    private String username;

    @Column(length = 200)
    private String avatar;

    @Column(length = 30)
    private String role;

}