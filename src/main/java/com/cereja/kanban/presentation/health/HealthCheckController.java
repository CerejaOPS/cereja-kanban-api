package com.cereja.kanban.presentation.health;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/health")
public class HealthCheckController {
    @GetMapping
    public ResponseEntity<Map<String, String>> healthcheck() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "message", "API no ar!"
        ));
    }
}
